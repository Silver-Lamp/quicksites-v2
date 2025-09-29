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
  const industry_other =
    typeof industry_other_raw === 'string' && industry_other_raw.trim().length
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

  const site_type = row.site_type ?? row.site_type_key ?? meta?.site_type ?? null;
  const business_name = row.business_name ?? meta?.business ?? identity?.business_name ?? null;

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

function isMissingRelation(err: any) {
  const msg = String(err?.message || err || '').toLowerCase();
  return msg.includes('relation') && msg.includes('does not exist');
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  const debugQ = url.searchParams.get('debug') === '1';
  if (!id) return j({ error: 'id required' }, 400);

  // Always use PUBLIC
  const pub = supabaseAdmin.schema('public');

  // 1) Primary template row
  let tplRow: any = null;
  let error: any = null;

  ({ data: tplRow, error } = await pub
    .from('templates')
    .select(TEMPLATE_EDITOR_SELECT)
    .eq('id', id)
    .maybeSingle());

  if (error && isMissingRelation(error)) {
    try {
      const alt = await pub
        .from('templates_public')   // optional view; ignore if absent
        .select(TEMPLATE_EDITOR_SELECT)
        .eq('id', id)
        .maybeSingle();
      tplRow = alt.data;
      error = alt.error && !isMissingRelation(alt.error) ? alt.error : null;
    } catch {}
  }

  if (error) return j({ error: error.message }, 404);
  if (!tplRow) return j({ error: 'not found' }, 404);

  const normalized = normalizeForEditor(tplRow);

  // 2) Derive history-backed rev and latest snapshot from public.template_versions
  const [{ data: latestVer }, { count: revCount }] = await Promise.all([
    pub
      .from('template_versions')
      .select('id, hash, saved_at, created_at')
      .eq('template_id', id)
      .order('saved_at', { ascending: false })      // try saved_at first
      .order('created_at', { ascending: false })    // then created_at
      .limit(1)
      .maybeSingle(),
    pub
      .from('template_versions')
      .select('id', { count: 'exact', head: true })
      .eq('template_id', id),
  ]);

  const currentRev = Number(revCount ?? 0);

  const lastSnapshot = latestVer
    ? {
        id: latestVer.id,
        rev: currentRev || null,
        hash: latestVer.hash ?? null,
        createdAt: latestVer.saved_at ?? latestVer.created_at ?? null,
      }
    : null;

  // 3) Discover publishedSnapshotId from multiple locations
  let publishedSnapshotId: string | null = null;
  try {
    // collect this template’s version ids
    const v = await pub.from('template_versions').select('id').eq('template_id', id);
    const versionIds = Array.isArray(v.data) ? v.data.map((r: any) => r.id) : [];

    if (versionIds.length) {
      const ps = await pub
        .from('published_sites')
        .select('snapshot_id, published_at')
        .order('published_at', { ascending: false })
        .limit(200);

      if (!ps.error && Array.isArray(ps.data)) {
        const hit = ps.data.find((r: any) => versionIds.includes(r.snapshot_id));
        if (hit) publishedSnapshotId = hit.snapshot_id;
      }
    }
  } catch {}


  // 3b) templates.published_snapshot_id column (if present)
  if (!publishedSnapshotId) {
    try {
      const tryCol = await pub
        .from('templates')
        .select('published_snapshot_id')
        .eq('id', id)
        .maybeSingle();
      if (!tryCol.error && tryCol.data?.published_snapshot_id) {
        publishedSnapshotId = tryCol.data.published_snapshot_id;
      }
    } catch {}
  }

  // 3c) templates.data.meta.publishedSnapshotId
  if (!publishedSnapshotId) {
    const m = (normalized?.data as any)?.meta;
    if (m?.publishedSnapshotId) publishedSnapshotId = m.publishedSnapshotId;
  }

  // 4) Shape response (back-compat: flatten + include template:)
  const payload = {
    ...normalized,                   // keep old callers working
    rev: currentRev,                 // history-derived rev
    lastSnapshot,
    site: {
      slug: normalized.slug ?? null,
      publishedSnapshotId: publishedSnapshotId ?? null,
    },
    template: normalized,            // new callers use template.*
    publishedSnapshotId: publishedSnapshotId ?? null,
  };

  if (DEBUG || debugQ) {
    console.log('[STATE:API] normalized', {
      id: payload.id,
      site_type: payload.site_type,
      industry: payload.industry,
      industry_label: payload.industry_label,
      contact_email: payload.contact_email,
      phone: payload.phone,
      city: payload.city,
      state: payload.state,
      postal_code: payload.postal_code,
      meta_identity: payload.template?.data?.meta?.identity,
      data_identity: payload.template?.data?.identity,
      rev: payload.rev,
      lastSnapshot: payload.lastSnapshot,
      publishedSnapshotId: payload.site?.publishedSnapshotId ?? null,
    });
  }

  const res = NextResponse.json(payload);
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
