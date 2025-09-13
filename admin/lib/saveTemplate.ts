'use server';

import { getSupabaseForAction } from '@/lib/supabase/serverClient';
import type { Template } from '@/types/template';

/** ---------- Sanitizers (server-side) ---------- */
function trimOrNull(v: any) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}
function numberOrNull(v: any) {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v));
  return Number.isFinite(n) ? n : null;
}
function digitsOrNull(v: any) {
  const s = String(v ?? '').replace(/\D/g, '');
  return s.length ? s : null;
}
/** Normalize services to a clean string[]; return undefined when not provided */
function cleanServices(v: any): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const arr = v.map((s) => String(s ?? '').trim()).filter(Boolean);
  return arr.length ? Array.from(new Set(arr)) : [];
}
/** Keep only defined keys; let nulls pass through, drop undefined */
function stripUndefined<T extends Record<string, any>>(obj: T): T {
  for (const k of Object.keys(obj)) {
    if (obj[k] === undefined) delete (obj as any)[k];
  }
  return obj;
}
const omit = <T extends object, K extends keyof T>(obj: T, ...keys: K[]): Omit<T, K> => {
  const clone: any = { ...obj };
  for (const k of keys) delete clone[k];
  return clone;
};

/* ---------- Helpers for safe merging ---------- */

const DEBUG_ID = process.env.DEBUG_IDENTITY === '1';
const dbg = (...args: any[]) => { if (DEBUG_ID) console.log(...args); };

function obj(v: any) {
  if (!v) return {};
  if (typeof v === 'object') return v;
  try { return JSON.parse(String(v)); } catch { return {}; }
}
const firstDef = <T>(...vals: T[]) =>
  vals.find((v) => v !== undefined && v !== null && String(v) !== '') as T | undefined;

/** Merge existing data with input data; mirror identity; keep legacy meta fields in sync */
function mergeDataWithIdentity(beforeData: any, inputData: any, columns: Record<string, any>) {
  const b = obj(beforeData);
  const i = obj(inputData);

  const bm = obj(b.meta);
  const im = obj(i.meta);

  const bi = obj(b.identity);
  const imi = obj(im.identity);
  const ii = obj(i.identity);

  // derive identity from columns when present
  const colContact = {
    email: columns.contact_email,
    phone: columns.phone,
    address: columns.address_line1,
    address2: columns.address_line2,
    city: columns.city,
    state: columns.state,
    postal: columns.postal_code,
    latitude: columns.latitude,
    longitude: columns.longitude,
  };
  const identityFromColumns: any = stripUndefined({
    template_name: columns.template_name,
    business_name: columns.business_name,
    site_type: columns.site_type,
    industry: columns.industry,
    industry_label: columns.industry_label,
    contact: stripUndefined({ ...colContact }),
  });

  // merged identity (prefer input, then existing, then columns)
  const mergedIdentity = stripUndefined({
    ...bm.identity,        // legacy stored
    ...bi,                 // data.identity old snapshot
    ...imi,                // input meta.identity
    ...ii,                 // input data.identity
    ...identityFromColumns // last — only fills blanks
  });

  // next meta.contact (keep legacy in sync)
  const nextMetaContact = stripUndefined({
    ...(obj(bm.contact)),
    ...(obj(im.contact)),
    email: firstDef(colContact.email, im?.contact?.email, bm?.contact?.email),
    phone: firstDef(colContact.phone, im?.contact?.phone, bm?.contact?.phone),
    address: firstDef(colContact.address, im?.contact?.address, bm?.contact?.address),
    address2: firstDef(colContact.address2, im?.contact?.address2, bm?.contact?.address2),
    city: firstDef(colContact.city, im?.contact?.city, bm?.contact?.city),
    state: firstDef(colContact.state, im?.contact?.state, bm?.contact?.state),
    postal: firstDef(colContact.postal, im?.contact?.postal, bm?.contact?.postal),
    latitude: firstDef(colContact.latitude, im?.contact?.latitude, bm?.contact?.latitude),
    longitude: firstDef(colContact.longitude, im?.contact?.longitude, bm?.contact?.longitude),
  });

  const nextMeta = stripUndefined({
    ...bm,
    ...im,
    siteTitle: firstDef(columns.template_name, im.siteTitle, bm.siteTitle),
    business: firstDef(columns.business_name, im.business, bm.business),
    site_type: firstDef(columns.site_type, im.site_type, bm.site_type),
    industry: firstDef(columns.industry, im.industry, bm.industry),
    industry_label: firstDef(columns.industry_label, im.industry_label, bm.industry_label),
    contact: nextMetaContact,
    identity: { ...(obj(bm.identity)), ...(obj(im.identity)), ...mergedIdentity },
  });

  const nextData = stripUndefined({
    ...b,
    ...i,
    meta: nextMeta,
    identity: { ...bi, ...ii, ...mergedIdentity }, // keep a snapshot at data.identity as well
  });

  dbg('[IDENTITY:SAVE] mergeDataWithIdentity', {
    columns,
    mergedIdentity,
    metaContact: nextMetaContact,
  });

  return nextData;
}

export async function saveTemplate(input: any, id?: string): Promise<Template> {
  const supabase = await getSupabaseForAction();

  // auth
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) throw new Error('Not authenticated');

  // unwrap input
  const src = input?.db ? input.db : input;
  const rowId = id ?? src?.id ?? undefined;

  // normalize services (prefer explicit services_jsonb, else services)
  const normalizedServices =
    cleanServices(src?.services_jsonb) ?? cleanServices(src?.services);

  // Build sanitized top-level columns (allow null to explicitly clear)
  const colTemplateName = trimOrNull(src?.template_name);
  const colBusinessName = trimOrNull(src?.business_name);
  const colSiteType     = trimOrNull(src?.site_type);
  const colIndustry     = trimOrNull(src?.industry);
  const colIndustryLbl  = trimOrNull(src?.industry_label);

  const colContactEmail = trimOrNull(src?.contact_email);
  const colPhone        = digitsOrNull(src?.phone);

  const colAddr1 = trimOrNull(src?.address_line1);
  const colAddr2 = trimOrNull(src?.address_line2);
  const colCity  = trimOrNull(src?.city);
  const colState = trimOrNull(src?.state);
  const colZip   = trimOrNull(src?.postal_code);

  const colLat   = numberOrNull(src?.latitude);
  const colLon   = numberOrNull(src?.longitude);

  // common payload base (we'll attach merged data below)
  const basePayload: Record<string, any> = {
    id: rowId,
    template_name: colTemplateName,
    slug: trimOrNull(src?.slug),

    layout: trimOrNull(src?.layout),
    color_scheme: trimOrNull(src?.color_scheme),
    theme: trimOrNull(src?.theme),
    brand: trimOrNull(src?.brand),
    industry: colIndustry,
    industry_label: colIndustryLbl,
    site_type: colSiteType,
    color_mode: trimOrNull(src?.color_mode),

    business_name: colBusinessName,
    contact_email: colContactEmail,
    phone: colPhone,

    address_line1: colAddr1,
    address_line2: colAddr2,
    city: colCity,
    state: colState,
    postal_code: colZip,

    latitude: colLat,
    longitude: colLon,

    // header/footer (keep your existing keys normalization)
    header_block: (input?.header_block ?? src?.header_block ?? src?.headerBlock) ?? null,
    footer_block: (input?.footer_block ?? src?.footer_block ?? src?.footerBlock) ?? null,

    // ✅ write to the JSONB column used by prod/view
    services_jsonb: normalizedServices,
    // NOTE: DO NOT set owner_id here; we decide per branch below
  };

  stripUndefined(basePayload);

  // columns we’ll use for identity backfill in data.meta / data.identity merging
  const columnsForIdentity = {
    template_name: colTemplateName,
    business_name: colBusinessName,
    site_type: colSiteType,
    industry: colIndustry,
    industry_label: colIndustryLbl,
    contact_email: colContactEmail,
    phone: colPhone,
    address_line1: colAddr1,
    address_line2: colAddr2,
    city: colCity,
    state: colState,
    postal_code: colZip,
    latitude: colLat,
    longitude: colLon,
  };

  // decide: create vs update (fetch `data` for safe merge)
  let exists = false;
  let beforeData: any = {};
  if (rowId) {
    const { data: existing, error: existsErr } = await supabase
      .from('templates')
      .select('id, owner_id, data')
      .eq('id', rowId)
      .maybeSingle();
    if (existsErr) throw new Error(JSON.stringify(existsErr));
    exists = !!existing;
    beforeData = existing?.data ?? {};
  }

  // Merge data with identity & legacy meta sync (using beforeData and src.data)
  const mergedData = mergeDataWithIdentity(beforeData, src?.data ?? {}, columnsForIdentity);

  dbg('[IDENTITY:SAVE] payload columns', basePayload);
  dbg('[IDENTITY:SAVE] merged data (top keys)', Object.keys(mergedData || {}));

  if (!exists) {
    // CREATE: include owner_id from session (write-once)
    const payload = { ...basePayload, owner_id: user.id, data: mergedData };
    const { data, error } = await supabase
      .from('templates')
      .insert(payload)
      .select()
      .single();
    if (error) throw new Error(JSON.stringify(error));
    return data as Template;
  } else {
    // UPDATE: never send owner_id; DB trigger prevents changes too
    const payload = omit({ ...basePayload, data: mergedData });
    const { data, error } = await supabase
      .from('templates')
      .update(payload)
      .eq('id', rowId!)
      .select()
      .single();
    if (error) throw new Error(JSON.stringify(error));
    return data as Template;
  }
}
