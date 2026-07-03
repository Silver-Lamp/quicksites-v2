// lib/builder/autogenerateForTemplate.ts
//
// Server-side "auto-run Suggest All + Generate" for an existing template. Used by
// the guest-build flow: a freshly-created homepage site is stamped
// data.meta.autogen_pending, and this fills in AI copy + a hero image once so the
// visitor doesn't have to open the hero editor and click the buttons.
//
// Reuses the metered generators from generateDemoSite (ideateCopy / generateHero),
// injects the result into the hero block + services block + meta, and persists via
// the sanctioned commit RPC (direct UPDATEs to templates are trigger-blocked).
import { createClient } from '@supabase/supabase-js';
import { ideateCopy, generateHero } from '@/lib/builder/generateDemoSite';
import { KEY_TO_LABEL, type IndustryKey } from '@/lib/industries';
import type { DemoSpec } from '@/lib/builder/randomDemoSpec';

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
    { auth: { persistSession: false } },
  );
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

  const industryKey = ((row as any).industry ?? meta.industry ?? 'other') as IndustryKey;
  const industryLabel = String(meta.industry_label || KEY_TO_LABEL[industryKey] || 'Local Services');
  const businessName = String((row as any).business_name || meta.business_name || (row as any).template_name || 'My Business');
  const city = String((row as any).city || meta.city || '');
  const state = String((row as any).state || meta.state || '');

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
    generateHero(spec, ownerId).catch(() => null),
  ]);

  // ── Inject into the first page's blocks ──────────────────────────────────────
  const pages: any[] = Array.isArray(data.pages) ? data.pages : [];
  const page0 = pages[0];
  const blocks: any[] = Array.isArray(page0?.blocks) ? page0.blocks : [];

  const hero = blocks.find((b) => b?.type === 'hero');
  if (hero) {
    hero.content = hero.content ?? {};
    if (copy.headline) hero.content.headline = copy.headline;
    if (copy.subheadline) hero.content.subheadline = copy.subheadline;
    if (heroUrl) {
      hero.content.image_url = heroUrl;
      hero.content.image = heroUrl;
      hero.content.heroImage = heroUrl;
      hero.content.backgroundImage = heroUrl;
      hero.content.layout_mode = hero.content.layout_mode && hero.content.layout_mode !== 'inline' ? hero.content.layout_mode : 'background';
      hero.content.layout = hero.content.layout && hero.content.layout !== 'inline' ? hero.content.layout : 'background';
      hero.content.overlay_level = hero.content.overlay_level ?? 'soft';
      hero.content.overlay = hero.content.overlay ?? 'soft';
    }
  }

  const services = blocks.find((b) => b?.type === 'services');
  if (services && Array.isArray(copy.services) && copy.services.length) {
    services.content = services.content ?? {};
    const items = copy.services.map((name) => ({ name }));
    if (Array.isArray(services.content.services)) services.content.services = items;
    else services.content.items = items;
  }

  // ── New data blob: mirror copy into meta (about/faqs/services), clear the flag ─
  const newData = {
    ...data,
    pages,
    services: copy.services?.length ? copy.services : data.services,
    meta: {
      ...meta,
      about: copy.about ?? meta.about ?? null,
      faqs: copy.faqs ?? meta.faqs ?? [],
      services: copy.services?.length ? copy.services : meta.services,
      autogen_pending: false,
      autogen_done_at_rev: (row as any).rev ?? 0,
    },
  };

  // ── Persist via the sanctioned commit RPC (direct UPDATE is trigger-blocked) ──
  const payload = {
    id: templateId,
    base_rev: (row as any).rev ?? 0,
    patch: { data: newData },
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
