// lib/builder/generateDemoSite.ts
//
// Orchestrates creation of one AI-generated demo site:
//   randomDemoSpec → ideate copy (metered) → hero image (metered) →
//   buildIndustryStarter (structure/theme) → insert template → publish (RPC) → tag is_demo.
//
// All OpenAI calls go through meterLLMCall so cost is logged to ai_usage_events +
// PostHog. dryRun returns the spec only (NO AI calls, NO writes → zero cost).

import { getOpenAI, resolveModel } from '@/lib/ai/openaiClient';
import { createClient } from '@supabase/supabase-js';
import { meterLLMCall } from '@/lib/ai/meter';
import { randomDemoSpec, type DemoSpec } from '@/lib/builder/randomDemoSpec';
import { buildIndustryStarter } from '@/lib/builder/industryScaffold';
import { LABEL_TO_KEY, KEY_TO_LABEL, type IndustryKey } from '@/lib/industries';

const ROUTE = '/api/admin/demos/generate';
const HERO_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'templates';

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!, {
    auth: { persistSession: false },
  });
}
function openai() {
  return getOpenAI('chat');
}
function openaiImage() {
  return getOpenAI('image');
}
function uuid() {
  return globalThis.crypto?.randomUUID?.() ?? `id_${Math.random().toString(36).slice(2)}${Date.now()}`;
}

type Copy = { headline: string; subheadline: string; about: string; services: string[]; faqs: { q: string; a: string }[] };

export type GenerateResult =
  | { ok: true; dryRun: true; spec: DemoSpec }
  | { ok: true; dryRun: false; id: string; slug: string; businessName: string; industryLabel: string; heroUrl: string | null }
  | { ok: false; error: string };

/** Industry labels already used by existing demo sites (for diversity). */
export async function usedDemoIndustryLabels(): Promise<string[]> {
  try {
    const { data } = await admin().from('templates').select('industry').eq('claim_source', 'demo_seed');
    const labels = new Set<string>();
    for (const r of data ?? []) {
      const k = (r as any).industry as IndustryKey | null;
      if (k && KEY_TO_LABEL[k]) labels.add(KEY_TO_LABEL[k]);
    }
    return [...labels];
  } catch {
    return [];
  }
}

export async function generateDemoSite(opts: {
  ownerId?: string | null;
  seed?: string;
  withHeroImage?: boolean;
  dryRun?: boolean;
  avoidIndustries?: string[];
}): Promise<GenerateResult> {
  const spec = randomDemoSpec(opts.seed, opts.avoidIndustries);

  if (opts.dryRun) return { ok: true, dryRun: true, spec };

  try {
    const industryKey: IndustryKey = LABEL_TO_KEY[spec.industryLabel.toLowerCase()] ?? 'other';

    // 1) Ideate site copy (metered chat)
    const copy = await ideateCopy(spec, opts.ownerId ?? null);

    // 2) Hero image (metered image) — best-effort; the site still works without it
    let heroUrl: string | null = null;
    if (opts.withHeroImage !== false) {
      heroUrl = await generateHero(spec, opts.ownerId ?? null).catch(() => null);
    }

    // 3) Build the template structure + theme, then inject AI copy + hero
    const tpl: any = buildIndustryStarter({ businessName: spec.businessName, industryKey });
    const page = tpl.data?.pages?.[0];
    const hero = page?.blocks?.[0];
    if (hero?.content) {
      hero.content.headline = copy.headline || spec.businessName;
      hero.content.subheadline = copy.subheadline || hero.content.subheadline;
      if (heroUrl) hero.content.image_url = heroUrl;
    }
    const services = copy.services?.length ? copy.services : tpl.services;
    tpl.services = services;
    tpl.data.services = services;
    tpl.data.meta = {
      ...(tpl.data.meta ?? {}),
      business_name: spec.businessName,
      about: copy.about ?? null,
      services,
      faqs: copy.faqs ?? [],
      city: spec.city,
      state: spec.state,
      is_demo: true,
    };

    // 4) Insert the template (service role; INSERT isn't guarded). Retry name on conflict.
    const db = admin();
    const baseName = spec.businessName;
    let insertedId: string | null = null;
    let slug = tpl.slug as string;
    for (let attempt = 0; attempt < 3 && !insertedId; attempt++) {
      const templateName = attempt === 0 ? baseName : `${baseName} · ${spec.city}${attempt > 1 ? ' ' + attempt : ''}`;
      const row: any = {
        id: uuid(),
        template_name: templateName,
        slug,
        data: tpl.data,
        color_mode: tpl.color_mode ?? 'light',
        header_block: tpl.data?.headerBlock ?? null,
        footer_block: tpl.data?.footerBlock ?? null,
        is_site: false, // publish RPC flips this true
        industry: industryKey,
        business_name: spec.businessName,
        claim_source: 'demo_seed',
        ...(opts.ownerId ? { owner_id: opts.ownerId } : {}),
      };
      const { data, error } = await db.from('templates').insert(row).select('id, slug').single();
      if (!error && data) {
        insertedId = data.id;
        slug = data.slug;
        break;
      }
      if (error && `${error.code}` === '23505') {
        // name or slug collision → vary both and retry
        slug = `${slug}-${Math.random().toString(36).slice(2, 5)}`;
        continue;
      }
      return { ok: false, error: error?.message || 'insert failed' };
    }
    if (!insertedId) return { ok: false, error: 'could not allocate unique template' };

    // 5) Publish via sanctioned RPC (snapshot + published_sites + flags)
    const { error: pErr } = await (db as any).rpc('publish_template_demo', { p_template_id: insertedId });
    if (pErr) return { ok: false, error: `published insert ok but publish failed: ${pErr.message}` };

    return { ok: true, dryRun: false, id: insertedId, slug, businessName: spec.businessName, industryLabel: spec.industryLabel, heroUrl };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'generation failed' };
  }
}

export type SiteCopy = Copy;
export async function ideateCopy(spec: DemoSpec, userId: string | null): Promise<Copy> {
  const sys =
    'You write concise, conversion-oriented website copy for local businesses. Return JSON ONLY ' +
    'with keys: headline (<=8 words), subheadline (<=18 words), about (2-3 sentences), ' +
    'services (array of 5 short service names), faqs (array of 3 {q,a}).';
  const user = `${spec.aiPrompt} Industry: ${spec.industryLabel}.`;

  return meterLLMCall<Copy>(
    { provider: 'openai', model_code: 'gpt-4o-mini', modality: 'chat', user_id: userId, route: ROUTE },
    async () => {
      const r = await openai().chat.completions.create({
        model: resolveModel('gpt-4o-mini', 'chat'),
        temperature: 0.8,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: user },
        ],
      });
      let parsed: any = {};
      try {
        parsed = JSON.parse(r.choices[0]?.message?.content || '{}');
      } catch {
        /* keep defaults below */
      }
      const value: Copy = {
        headline: String(parsed.headline || spec.businessName),
        subheadline: String(parsed.subheadline || `Trusted ${spec.industryLabel.toLowerCase()} in ${spec.city}.`),
        about: String(parsed.about || ''),
        services: Array.isArray(parsed.services) ? parsed.services.map(String).slice(0, 6) : [],
        faqs: Array.isArray(parsed.faqs)
          ? parsed.faqs.map((f: any) => ({ q: String(f?.q ?? ''), a: String(f?.a ?? '') })).slice(0, 3)
          : [],
      };
      return {
        value,
        usage: { input_tokens: r.usage?.prompt_tokens, output_tokens: r.usage?.completion_tokens },
      };
    }
  );
}

export async function generateHero(spec: DemoSpec, userId: string | null): Promise<string | null> {
  const prompt =
    `Professional hero photo for a ${spec.industryLabel} business named "${spec.businessName}" in ${spec.city}, ${spec.state}. ` +
    `Real-world, high quality, on-brand, no text, no logos.`;

  const dataUrl = await meterLLMCall<string | null>(
    { provider: 'openai', model_code: 'gpt-image-1', modality: 'image', user_id: userId, route: ROUTE },
    async () => {
      const gen = await openaiImage().images.generate({ model: 'gpt-image-1', prompt, size: '1536x1024', quality: 'medium' });
      const b64 = gen.data?.[0]?.b64_json;
      return { value: b64 ? `data:image/png;base64,${b64}` : null, usage: { images: 1 } };
    }
  );
  if (!dataUrl) return null;

  const [, b64] = dataUrl.split(',');
  const buffer = Buffer.from(b64, 'base64');
  const db = admin();
  const path = `demo/${slugify(spec.businessName)}/hero/${uuid()}.png`;
  const { error } = await db.storage.from(HERO_BUCKET).upload(path, buffer, { contentType: 'image/png', upsert: true });
  if (error) return null;
  const { data } = db.storage.from(HERO_BUCKET).getPublicUrl(path);
  return data?.publicUrl ?? null;
}

function slugify(s: string) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60) || 'demo';
}
