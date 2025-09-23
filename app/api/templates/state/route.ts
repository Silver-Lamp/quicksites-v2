// app/api/templates/state/route.ts
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server/supabaseAdmin';

function j(data: any, init?: number | ResponseInit) {
  const resInit = typeof init === 'number' ? { status: init } : init;
  return NextResponse.json(data, resInit);
}
const DEBUG = process.env.DEBUG_IDENTITY === '1';
const dbg = (...args: any[]) => { if (DEBUG) console.log(...args); };

function obj(v: any) {
  if (!v) return {};
  if (typeof v === 'object') return v;
  try { return JSON.parse(String(v)); } catch { return {}; }
}

/* ---------------- industry helpers ---------------- */

function toSlug(s: any): string | null {
  if (s == null) return null;
  const raw = String(s).trim().toLowerCase();
  if (!raw) return null;
  const slug = raw
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return slug || null;
}
function humanizeSlug(slug: string): string {
  return slug
    .split(/[_-]/g)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function normalizeIndustryTriplet(row: any, meta: any) {
  const rowKey = row?.industry;
  const metaKey = meta?.industry;

  const candidate = [rowKey, metaKey].find((v) => v != null && String(v).trim() !== '');
  const keySlug = toSlug(candidate);

  let industry: string | null = keySlug || null;
  let industry_label: string | null = row?.industry_label ?? meta?.industry_label ?? null;
  const industry_other_raw = meta?.industry_other ?? null;
  const industry_other = typeof industry_other_raw === 'string' && industry_other_raw.trim().length
    ? industry_other_raw.trim()
    : null;

  if (!industry && industry_other) industry = 'other';
  if (industry && (!industry_label || !industry_label.trim())) {
    industry_label = industry === 'other' ? 'Other' : humanizeSlug(industry);
  }
  const final_other = industry === 'other' ? industry_other : null;

  return { industry, industry_label, industry_other: final_other };
}

const TEMPLATE_EDITOR_SELECT = [
  'id','slug','base_slug','rev','updated_at',
  'template_name','business_name',
  'industry','industry_label',
  'site_type','site_type_key','site_type_label',
  'contact_email','phone',
  'address_line1','address_line2','city','state','postal_code',
  'latitude','longitude',
  'color_mode','color_scheme','layout',
  'data',
].join(', ');

function normalizeForEditor(row: any) {
  const data = obj(row?.data);
  const meta = obj(data?.meta);
  const metaId = obj(meta?.identity);
  const dataId = obj(data?.identity);

  const identity = { ...metaId, ...dataId };
  const contact = obj(identity?.contact);
  const metaContact = obj(meta?.contact);

  const site_type =
    row.site_type ?? row.site_type_key ?? meta?.site_type ?? null;

  const business_name =
    row.business_name ?? meta?.business ?? identity?.business_name ?? null;

  const contact_email = row.contact_email ?? contact.email ?? metaContact.email ?? null;
  const phone         = row.phone         ?? contact.phone  ?? metaContact.phone  ?? null;

  const address_line1 = row.address_line1 ?? contact.address  ?? metaContact.address  ?? null;
  const address_line2 = row.address_line2 ?? contact.address2 ?? metaContact.address2 ?? null;
  const city          = row.city          ?? contact.city     ?? metaContact.city     ?? null;
  const state         = row.state         ?? contact.state    ?? metaContact.state    ?? null;
  const postal_code   = row.postal_code   ?? contact.postal   ?? metaContact.postal   ?? null;
  const latitude      = row.latitude      ?? contact.latitude ?? metaContact.latitude ?? null;
  const longitude     = row.longitude     ?? contact.longitude?? metaContact.longitude?? null;

  const ind = normalizeIndustryTriplet(row, meta);

  return {
    ...row,
    site_type,
    business_name,
    industry: ind.industry,
    industry_label: ind.industry_label,

    contact_email,
    phone,
    address_line1,
    address_line2,
    city,
    state,
    postal_code,
    latitude,
    longitude,

    data: {
      ...data,
      identity: { ...(data.identity || {}), ...identity },
      meta: {
        ...meta,
        identity: { ...(meta.identity || {}), ...identity },
        industry: ind.industry,
        industry_label: ind.industry_label,
        industry_other: ind.industry_other,
      },
    },
  };
}

// helper: only treat as "missing relation" if error text clearly says so
function isMissingRelation(err: any) {
  const msg = String(err?.message || err || '').toLowerCase();
  return msg.includes('relation') && msg.includes('does not exist');
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  const debugQ = url.searchParams.get('debug') === '1';
  if (!id) return j({ error: 'id required' }, 400);

  // Always use PUBLIC for templates (admin client may default to 'app')
  const pub = supabaseAdmin.schema('public');

  // 1) Primary: public.templates
  let data: any = null;
  let error: any = null;

  ({ data, error } = await pub
    .from('templates')
    .select(TEMPLATE_EDITOR_SELECT)
    .eq('id', id)
    .maybeSingle());

  // 2) Only fallback to a view if the *table* is actually missing
  if (error && isMissingRelation(error)) {
    try {
      const alt = await pub
        .from('templates_public')   // optional view; ignore if absent
        .select(TEMPLATE_EDITOR_SELECT)
        .eq('id', id)
        .maybeSingle();
      data = alt.data;
      error = alt.error && !isMissingRelation(alt.error) ? alt.error : null;
    } catch {
      // ignore; we'll return the original error below
    }
  }

  // If we still have an error (and it wasn't the quiet-missing-view case), return it
  if (error) return j({ error: error.message }, 404);

  // If no row found, do NOT try the view—return not found
  if (!data) return j({ error: 'not found' }, 404);

  const normalized = normalizeForEditor(data);

  if (DEBUG || debugQ) {
    console.log('[STATE:API] normalized', {
      id: normalized.id,
      site_type: normalized.site_type,
      industry: normalized.industry,
      industry_label: normalized.industry_label,
      contact_email: normalized.contact_email,
      phone: normalized.phone,
      city: normalized.city,
      state: normalized.state,
      postal_code: normalized.postal_code,
      meta_identity: normalized.data?.meta?.identity,
      data_identity: normalized.data?.identity,
    });
  }

  const res = NextResponse.json({ template: normalized });
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
