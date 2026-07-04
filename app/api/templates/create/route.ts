// app/api/templates/create/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSupabase } from '@/lib/supabase/server';
import { checkRateLimit, clientIp } from '@/lib/rateLimit';
import { inferIndustry } from '@/lib/builder/inferIndustry';
import { buildIndustryStarter } from '@/lib/builder/industryScaffold';
import type { IndustryKey } from '@/lib/industries';

export const runtime = 'nodejs';
// A guest with no industry triggers one cheap gpt-4o-mini inference (~2s); give the
// handler headroom over the default serverless timeout.
export const maxDuration = 30;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!; // service role (NOT exposed to client)
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

// tiny helpers
function obj(v: any) {
  if (!v) return {};
  if (typeof v === 'object') return v;
  try { return JSON.parse(String(v)); } catch { return {}; }
}

/** If meta.industry === 'other' AND no industry_other text AND no site_type,
 *  treat it as "unset" and remove it so the UI won't snap to Other.
 */
function stripSeededOther(metaIn: any) {
  const meta = { ...obj(metaIn) };
  const key = (meta.industry ?? '').toString().trim().toLowerCase();
  const otherText = (meta.industry_other ?? '').toString().trim();
  const siteType = meta.site_type ?? null;

  const looksSeededOther = key === 'other' && !otherText && (siteType === null || siteType === undefined);
  if (looksSeededOther) {
    delete meta.industry;
    delete meta.industry_label;
    if (!otherText) delete meta.industry_other;
  }
  return meta;
}

export async function POST(req: Request) {
  const initial = await req.json();

  // pull data
  const dataIn = obj(initial.data);

  // Accept header/footer blocks from either shape
  const headerBlock = initial.headerBlock ?? dataIn.headerBlock ?? null;
  const footerBlock = initial.footerBlock ?? dataIn.footerBlock ?? null;

  // Stamp ownership from the caller's session (works for both real and
  // anonymous/guest users). Setting owner_id = the anon uid is what lets the
  // draft auto-claim when the guest later upgrades their account (same uid).
  let ownerId: string | null = null;
  let isAnonymous = false;
  try {
    const ssr = await getServerSupabase();
    const { data: { user } } = await ssr.auth.getUser();
    ownerId = user?.id ?? null;
    isAnonymous = !!user?.is_anonymous;
  } catch {
    // no session (e.g. legacy callers) — leave owner_id null as before
  }

  // Abuse guard: cap how many drafts a single IP can spin up as a guest, so a bot
  // can't mint thousands of anon users + template rows. Real (signed-in) users are
  // exempt. GUEST_DRAFT_HOURLY_LIMIT_PER_IP=0 disables. (Runs before the industry
  // inference so a rate-limited request never spends an LLM call.)
  if (isAnonymous) {
    const limit = Number(process.env.GUEST_DRAFT_HOURLY_LIMIT_PER_IP ?? '10') || 0;
    const rl = await checkRateLimit(`guest_draft:${clientIp(req)}`, limit, 3600);
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Too many draft sites from this network. Sign up to keep building.', code: 'rate_limited' },
        { status: 429 },
      );
    }
  }

  // Default: keep the client-built scaffold, with meta sanitized.
  let data: any = { ...dataIn, meta: stripSeededOther(dataIn.meta) };
  let templateName = initial.template_name ?? initial.slug ?? 'Untitled';
  let colorMode = initial.color_mode ?? dataIn?.color_mode ?? 'light';
  let industryCol: string | undefined;

  // If a guest didn't pick an industry, infer it from the business name NOW (at
  // creation) — so the editor's "what kind of site" chooser is pre-answered on
  // first load (no flash) — and re-scaffold with the inferred industry for a more
  // fitting theme + services. Preserves the slug + the autogen flag. Best-effort.
  const rawMeta = obj(dataIn.meta);
  const curKey = String(rawMeta.industry || '').toLowerCase();
  const industryUnknown = !curKey || curKey === 'other';
  const businessName = String(rawMeta.business_name || initial.template_name || '').trim();
  if (isAnonymous && industryUnknown && businessName) {
    const inferred = await inferIndustry(businessName, ownerId);
    if (inferred) {
      const rebuilt: any = buildIndustryStarter({ businessName, industryKey: inferred.key as IndustryKey });
      const rebuiltData = obj(rebuilt.data);
      rebuiltData.meta = {
        ...(rebuiltData.meta || {}),
        industry: inferred.key,
        industry_label: inferred.label,
        industry_other: inferred.key === 'other' ? inferred.label : null,
        site_type: rebuiltData.meta?.site_type || 'small_business',
        autogen_pending: true, // keep the hero copy/image auto-run
      };
      data = rebuiltData;
      templateName = rebuilt.template_name || templateName;
      colorMode = rebuilt.color_mode || colorMode;
      industryCol = String(inferred.key);
    }
  }

  // Build minimal, canonical payload
  const payload: any = {
    template_name: templateName,
    slug: initial.slug,
    data,
    color_mode: colorMode,
    header_block: headerBlock ?? null,
    footer_block: footerBlock ?? null,
    ...(typeof initial.is_site === 'boolean' ? { is_site: initial.is_site } : {}),
    ...(ownerId ? { owner_id: ownerId } : {}),
    ...(isAnonymous ? { claim_source: 'guest_build' } : {}),
    // industry column is only set when we inferred it for a guest (else left unset)
    ...(industryCol ? { industry: industryCol } : {}),
  };

  const { data: inserted, error } = await admin
    .from('templates')
    .insert(payload)
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // refresh the materialized view; don’t crash the request if this fails
  try {
    await admin.rpc('refresh_template_bases');
  } catch (e) {
    console.error('refresh_template_bases failed:', e);
  }

  return NextResponse.json({ id: inserted.id });
}
