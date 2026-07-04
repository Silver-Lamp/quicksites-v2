// lib/builder/autogenerateForTemplate.ts
//
// Server-side "auto-run Suggest All + Generate" for an existing template. Used by
// the guest-build flow: a freshly-created homepage site is stamped
// data.meta.autogen_pending, and this fills in AI copy + a hero image once so the
// visitor doesn't have to open the hero editor and click the buttons.
//
// Reuses ideateCopy (metered chat) from generateDemoSite for copy, and generates
// the hero image inline (with a retry + logging + the proven public storage path)
// — the demo generator's generateHero swallowed failures silently, which left some
// guest sites with no hero. Injects into the hero + services blocks + meta and
// persists via the sanctioned commit RPC (direct UPDATEs to templates are blocked).
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { ideateCopy } from '@/lib/builder/generateDemoSite';
import { inferIndustry } from '@/lib/builder/inferIndustry';
import { meterLLMCall } from '@/lib/ai/meter';
import { KEY_TO_LABEL, type IndustryKey } from '@/lib/industries';
import type { DemoSpec } from '@/lib/builder/randomDemoSpec';

const HERO_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'templates';

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
    { auth: { persistSession: false } },
  );
}

function uid() {
  return globalThis.crypto?.randomUUID?.() ?? `id_${Math.random().toString(36).slice(2)}${Date.now()}`;
}

/**
 * Generate a hero image and upload it to the public templates bucket at the same
 * path the editor's manual "Generate" uses (template-<id>/hero/...). Retries once
 * (gpt-image-1 can intermittently fail/moderate), logs failures, and returns null
 * only if it genuinely can't produce one — the site still works without an image.
 */
async function generateAndUploadHero(
  db: ReturnType<typeof admin>,
  templateId: string,
  spec: DemoSpec,
  ownerId: string | null,
): Promise<string | null> {
  const label =
    spec.industryLabel && spec.industryLabel.toLowerCase() !== 'other'
      ? spec.industryLabel
      : spec.businessName || 'local business';
  const prompt =
    `Professional website hero/banner photo for "${spec.businessName}" — a ${label} business` +
    `${spec.city ? ` in ${spec.city}${spec.state ? `, ${spec.state}` : ''}` : ''}. ` +
    `Wide 16:9 composition with clear copy space, real-world, high quality, clean modern background. ` +
    `No people, no faces, no text, no watermark, no logo.`;
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const b64 = await meterLLMCall<string | null>(
        { provider: 'openai', model_code: 'gpt-image-1', modality: 'image', user_id: ownerId, route: '/api/templates/[id]/autogenerate' },
        async () => {
          const gen = await openai.images.generate({ model: 'gpt-image-1', prompt, size: '1536x1024', quality: 'medium' });
          return { value: gen.data?.[0]?.b64_json ?? null, usage: { images: 1 } };
        },
      );
      if (!b64) {
        console.error(`[autogen] hero image returned empty (attempt ${attempt + 1})`);
        continue;
      }
      const buffer = Buffer.from(b64, 'base64');
      const path = `template-${templateId}/hero/${uid()}.png`;
      const { error: upErr } = await db.storage.from(HERO_BUCKET).upload(path, buffer, { contentType: 'image/png', upsert: true });
      if (upErr) {
        console.error('[autogen] hero image upload failed:', upErr.message);
        return null;
      }
      const { data } = db.storage.from(HERO_BUCKET).getPublicUrl(path);
      return data?.publicUrl ?? null;
    } catch (e: any) {
      console.error(`[autogen] hero image generation failed (attempt ${attempt + 1}):`, e?.message || e);
    }
  }
  return null;
}

type Result = { ok: true; heroUrl: string | null } | { ok: false; error: string };

export async function autogenerateForTemplate(templateId: string, ownerId: string | null): Promise<Result> {
  const db = admin();

  const { data: row, error } = await db
    .from('templates')
    .select('id, rev, data, business_name, industry, city, state, template_name')
    .eq('id', templateId)
    .maybeSingle();
  if (error || !row) return { ok: false, error: error?.message || 'template not found' };

  const data: any = (row as any).data ?? {};
  const meta: any = data.meta ?? {};

  // Idempotency backstop: only run while autogen_pending is set. Once the first
  // run commits (clearing the flag), any duplicate call — e.g. from a second
  // editor tab or a refresh — no-ops instead of regenerating (which would burn AI
  // calls and fire concurrent gpt-image-1 requests that OpenAI rate-limits).
  if (meta.autogen_pending !== true) {
    return { ok: true, heroUrl: null };
  }

  let industryKey = ((row as any).industry ?? meta.industry ?? 'other') as IndustryKey;
  let industryLabel = String(meta.industry_label || KEY_TO_LABEL[industryKey] || '');
  const businessName = String((row as any).business_name || meta.business_name || (row as any).template_name || 'My Business');
  const city = String((row as any).city || meta.city || '');
  const state = String((row as any).state || meta.state || '');

  // If the guest didn't pick an industry, infer it from the business name so the
  // copy + image are relevant (and the editor's chooser is pre-answered).
  const industryUnknown = !industryKey || industryKey === 'other' || !industryLabel || industryLabel.toLowerCase() === 'other';
  if (industryUnknown && businessName && businessName !== 'My Business') {
    const inferred = await inferIndustry(businessName, ownerId);
    if (inferred) {
      industryKey = inferred.key;
      industryLabel = inferred.label;
    }
  }
  if (!industryLabel) industryLabel = 'Local Services';

  const spec: DemoSpec = {
    industryLabel,
    businessName,
    city,
    state,
    productType: 'service',
    productsCount: 0,
    aiPrompt: `Write website copy for "${businessName}", a ${industryLabel} business${city ? ` in ${city}${state ? `, ${state}` : ''}` : ''}.`,
  };

  // Copy + hero in parallel; the image is best-effort (site still works without it).
  const [copy, heroUrl] = await Promise.all([
    ideateCopy(spec, ownerId),
    generateAndUploadHero(db, templateId, spec, ownerId),
  ]);

  // ── Inject into the first page's blocks ──────────────────────────────────────
  const pages: any[] = Array.isArray(data.pages) ? data.pages : [];
  const page0 = pages[0];
  const blocks: any[] = Array.isArray(page0?.blocks) ? page0.blocks : [];

  const hero = blocks.find((b) => b?.type === 'hero');
  if (hero) {
    // Write the hero copy + image onto BOTH content and props. The editor's manual
    // "Generate" writes both (hero-editor.tsx fieldKey/altKey) and renders, whereas
    // a content-only write showed in the public preview but NOT in the editor
    // canvas — so mirror the working manual pattern.
    const applyHero = (target: any) => {
      if (copy.headline) target.headline = copy.headline;
      if (copy.subheadline) target.subheadline = copy.subheadline;
      if (heroUrl) {
        target.image_url = heroUrl;
        target.image = heroUrl;
        target.heroImage = heroUrl;
        target.backgroundImage = heroUrl;
        target.layout_mode = target.layout_mode && target.layout_mode !== 'inline' ? target.layout_mode : 'background';
        target.layout = target.layout && target.layout !== 'inline' ? target.layout : 'background';
        target.overlay_level = target.overlay_level ?? 'soft';
        target.overlay = target.overlay ?? 'soft';
      }
    };
    hero.content = hero.content ?? {};
    hero.props = hero.props ?? {};
    applyHero(hero.content);
    applyHero(hero.props);
  }

  const services = blocks.find((b) => b?.type === 'services');
  if (services && Array.isArray(copy.services) && copy.services.length) {
    services.content = services.content ?? {};
    const items = copy.services.map((name) => ({ name }));
    if (Array.isArray(services.content.services)) services.content.services = items;
    else services.content.items = items;
  }

  // Keep the legacy `content_blocks` mirror in sync with `blocks`. The scaffold
  // writes both, and after a JSON round-trip they're separate arrays — the editor
  // canvas renders from content_blocks while the public renderer uses blocks, so a
  // blocks-only update showed the AI hero in preview but NOT in the editor.
  if (page0 && Array.isArray((page0 as any).content_blocks)) {
    (page0 as any).content_blocks = blocks;
  }

  // ── New data blob: mirror copy into meta (about/faqs/services), clear the flag ─
  const newData = {
    ...data,
    pages,
    services: copy.services?.length ? copy.services : data.services,
    meta: {
      ...meta,
      // Persist the (possibly inferred) industry so the editor's "what kind of
      // site" chooser is pre-answered and the theme layer can read it.
      industry: industryKey,
      industry_label: industryLabel,
      // When the inferred label isn't a known key, keep it as free text so the
      // chooser reads as answered (industry=other + industry_other → step 2).
      industry_other: industryKey === 'other' ? industryLabel : null,
      site_type: meta.site_type || 'small_business',
      about: copy.about ?? meta.about ?? null,
      faqs: copy.faqs ?? meta.faqs ?? [],
      services: copy.services?.length ? copy.services : meta.services,
      // Default contact email so the contact form is functional out of the box
      // (a placeholder the owner replaces on sign-up/publish). Only set if unset.
      contact_email:
        meta.contact_email ||
        `hello@${(businessName || 'your-business').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40) || 'your-business'}.com`,
      autogen_pending: false,
      autogen_done_at_rev: (row as any).rev ?? 0,
    },
  };

  // ── Persist via the sanctioned commit RPC (direct UPDATE is trigger-blocked) ──
  const payload = {
    id: templateId,
    base_rev: (row as any).rev ?? 0,
    // Also promote industry to the column so theme/industry resolution + the
    // editor pick it up (not just data.meta).
    patch: { data: newData, industry: industryKey },
    actor: ownerId,
    kind: 'save',
    org_id: null,
  };

  let rpcErr: any = null;
  {
    const { error: e } = await (db as any).schema('public').rpc('commit_template_http', { p_payload: payload });
    rpcErr = e;
  }
  if (rpcErr) {
    const { error: e2 } = await (db as any).schema('app').rpc('commit_template', { p_payload: payload });
    rpcErr = e2;
  }
  if (rpcErr) return { ok: false, error: rpcErr.message || 'commit failed' };

  return { ok: true, heroUrl };
}
