// app/api/templates/create/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // service role (NOT exposed to client)
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

  // pull data & sanitize meta
  const dataIn = obj(initial.data);
  const metaClean = stripSeededOther(dataIn.meta);

  const data = {
    ...dataIn,
    meta: metaClean,
  };

  // Accept header/footer blocks from either shape
  const headerBlock = initial.headerBlock ?? dataIn.headerBlock ?? null;
  const footerBlock = initial.footerBlock ?? dataIn.footerBlock ?? null;

  // Build minimal, canonical payload (don’t send generated cols)
  const payload: any = {
    template_name: initial.template_name ?? initial.slug ?? 'Untitled',
    slug: initial.slug,
    data,
    color_mode: initial.color_mode ?? dataIn?.color_mode ?? 'light',
    header_block: headerBlock ?? null,
    footer_block: footerBlock ?? null,
    ...(typeof initial.is_site === 'boolean' ? { is_site: initial.is_site } : {}),
    // ❌ never set industry/industry_label columns at creation
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
