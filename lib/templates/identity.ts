// lib/templates/identity.ts
//
// Pure template-commit transforms, extracted from app/api/templates/commit so
// they can be unit-tested in isolation (no Supabase, no request). These shape the
// editor's identity/meta/contact mirrors and normalize the industry triplet
// before a commit. Keep them free of I/O.

const DEBUG_ID = process.env.DEBUG_IDENTITY === '1';
const dbg = (...args: any[]) => { if (DEBUG_ID) console.log(...args); };

/** Recursively drop '' values (→ undefined), preserving structure. */
export function stripEmpty(v: any): any {
  if (v === '') return undefined;
  if (Array.isArray(v)) return v.map(stripEmpty);
  if (v && typeof v === 'object') {
    const out: any = {};
    for (const [k, val] of Object.entries(v)) {
      const n = stripEmpty(val);
      if (n !== undefined) out[k] = n;
    }
    return out;
  }
  return v;
}

/** Forgiving parse: object passthrough, JSON string → object, else {}. */
export function obj(v: any) {
  if (!v) return {};
  if (typeof v === 'object') return v;
  try { return JSON.parse(String(v)); } catch { return {}; }
}

/** Deep get by path. */
export function dget(o: any, path: string[]): any {
  return path.reduce((acc, k) => (acc && typeof acc === 'object' ? acc[k] : undefined), o);
}

/** Deep delete by path (mutates). */
export function ddel(o: any, path: string[]): void {
  if (!o || typeof o !== 'object') return;
  const last = path[path.length - 1];
  const parent = path.slice(0, -1).reduce((acc, k) => (acc && typeof acc === 'object' ? acc[k] : undefined), o);
  if (parent && typeof parent === 'object') {
    try { delete (parent as any)[last]; } catch {}
  }
}

/* ─────────────── industry helpers ─────────────── */

export function toSlug(s: any): string | null {
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

export function humanizeSlug(slug: string): string {
  return slug.split(/[_-]/g).filter(Boolean).map(w => w[0]?.toUpperCase() + w.slice(1)).join(' ');
}

/** Resolve the (industry, industry_label, industry_other) triplet, preferring the
 *  incoming meta, then the previous meta. Returns {} when nothing is known. */
export function normalizeIndustryTriplet(incomingMeta: any, beforeMeta: any) {
  const inKeySlug = toSlug(incomingMeta?.industry);
  const inLabel = (incomingMeta?.industry_label ?? '').toString().trim() || null;
  const inOther = (incomingMeta?.industry_other ?? '').toString().trim() || null;

  const prevKeySlug = toSlug(beforeMeta?.industry);
  const prevLabel = (beforeMeta?.industry_label ?? '').toString().trim() || null;
  const prevOther = (beforeMeta?.industry_other ?? '').toString().trim() || null;

  if (inKeySlug) {
    if (inKeySlug === 'other') {
      return { industry: 'other', industry_label: inLabel || 'Other', industry_other: inOther || null };
    }
    return { industry: inKeySlug, industry_label: inLabel || humanizeSlug(inKeySlug), industry_other: null };
  }
  if (inOther && !inKeySlug) return { industry: 'other', industry_label: 'Other', industry_other: inOther };
  if (prevKeySlug) {
    if (prevKeySlug === 'other') return { industry: 'other', industry_label: prevLabel || 'Other', industry_other: prevOther || null };
    return { industry: prevKeySlug, industry_label: prevLabel || humanizeSlug(prevKeySlug), industry_other: null };
  }
  return {};
}

/**
 * The meta keys `enrichPatchWithIdentity` OWNS and normalizes. Documentation only — it no
 * longer filters what survives a commit. See the note at the nextMeta assignment for what
 * happened when it did.
 */
const ALLOWED_META_KEYS = new Set<string>([
  'identity', 'industry', 'industry_label', 'industry_other',
  'site_type', 'siteTitle', 'business', 'contact', 'services',
]);

/** Merge identity mirrors + keep columns in sync; normalize industry triplet. */
export function enrichPatchWithIdentity(originalPatch: any, beforeData: any) {
  const patch = { ...(originalPatch || {}) };
  const inData = obj(patch.data);
  const inMeta = obj(inData.meta);
  const beforeMeta = obj(beforeData?.meta);

  if (DEBUG_ID) dbg('[IDENTITY:API] patch.meta =', JSON.stringify(inMeta));

  const idFromData = obj(inData.identity);
  const idFromMeta = obj(inMeta.identity);
  const identity = Object.keys(idFromData).length ? idFromData : (Object.keys(idFromMeta).length ? idFromMeta : null);

  const contact = obj(identity?.contact);
  const prevMetaIdentity = obj(beforeMeta.identity);
  const mergedMetaIdentity = { ...prevMetaIdentity, ...idFromMeta, ...idFromData };

  const metaBase: any = { ...beforeMeta, ...inMeta };
  metaBase.siteTitle = identity?.template_name ?? metaBase.siteTitle ?? null;
  metaBase.business  = identity?.business_name ?? metaBase.business ?? null;
  metaBase.site_type = identity?.site_type ?? metaBase.site_type ?? null;

  const normIndustry = normalizeIndustryTriplet(inMeta, beforeMeta);

  /**
   * ⚠️ THIS USED TO BE AN ALLOWLIST, AND IT SILENTLY ATE EVERY META KEY IT DID NOT KNOW.
   *
   * The line was:
   *     for (const k of Object.keys(metaBase)) if (ALLOWED_META_KEYS.has(k)) nextMeta[k] = ...
   *
   * `ALLOWED_META_KEYS` lists the nine identity mirrors this function normalizes. Rebuilding
   * `meta` from it meant EVERY OTHER KEY WAS DROPPED ON EVERY COMMIT — not by a rule about
   * meta, but as a side effect of a helper whose job is identity. Two features died on it:
   *
   *   • `meta.ecom.merchant_id` — the link to the merchant that can charge a card. Written
   *     server-side, gone on the owner's next save. The menu kept its "Add to order" buttons
   *     because those live under `pages`, so the site looked like a working store with no till.
   *   • `meta.payments.venmo` — saved, rendered in the preview, never in the row. Survived
   *     three separate "fix the save path" attempts tonight, because the save path was fine:
   *     the write reached the server and this function removed the key before it landed.
   *
   * The tell was in the data the whole time: the stored meta had exactly nine keys, and they
   * were exactly this list.
   *
   * Now: keep everything, then normalize the identity mirrors on top. A key that nobody here
   * has heard of is not evidence that it is junk. The allowlist stays only as documentation of
   * which keys this function OWNS — it no longer decides what survives, because "add your key
   * to a list in a file you'd never think to open" is a trap that only springs in production.
   */
  const nextMeta: any = { ...metaBase };
  nextMeta.identity = mergedMetaIdentity;
  if (normIndustry.industry        !== undefined) nextMeta.industry        = normIndustry.industry;
  if (normIndustry.industry_label  !== undefined) nextMeta.industry_label  = normIndustry.industry_label;
  if (normIndustry.industry_other  !== undefined) nextMeta.industry_other  = normIndustry.industry_other;

  nextMeta.contact = {
    ...(obj(beforeMeta.contact)), ...(obj(inMeta.contact)),
    email:     contact.email     ?? inMeta?.contact?.email     ?? beforeMeta?.contact?.email     ?? null,
    phone:     contact.phone     ?? inMeta?.contact?.phone     ?? beforeMeta?.contact?.phone     ?? null,
    address:   contact.address   ?? inMeta?.contact?.address   ?? beforeMeta?.contact?.address   ?? null,
    address2:  contact.address2  ?? inMeta?.contact?.address2  ?? beforeMeta?.contact?.address2  ?? null,
    city:      contact.city      ?? inMeta?.contact?.city      ?? beforeMeta?.contact?.city      ?? null,
    state:     contact.state     ?? inMeta?.contact?.state     ?? beforeMeta?.contact?.state     ?? null,
    postal:    contact.postal    ?? inMeta?.contact?.postal    ?? beforeMeta?.contact?.postal    ?? null,
    latitude:  contact.latitude  ?? inMeta?.contact?.latitude  ?? beforeMeta?.contact?.latitude  ?? null,
    longitude: contact.longitude ?? inMeta?.contact?.longitude ?? beforeMeta?.contact?.longitude ?? null,
  };

  const nextData = { ...inData, identity: { ...(obj(inData.identity)), ...mergedMetaIdentity }, meta: nextMeta };

  const setIfUndef = (k: string, v: any) => { if ((patch as any)[k] === undefined && v !== undefined && v !== null && v !== '') (patch as any)[k] = v; };

  setIfUndef('template_name', identity?.template_name);
  setIfUndef('business_name', identity?.business_name);
  setIfUndef('site_type', identity?.site_type);

  const colIndustry      = normIndustry.industry      ?? identity?.industry;
  const colIndustryLabel = normIndustry.industry_label?? identity?.industry_label;
  setIfUndef('industry', colIndustry);
  setIfUndef('industry_label', colIndustryLabel);

  setIfUndef('contact_email',  contact.email);
  setIfUndef('phone',          contact.phone);
  setIfUndef('address_line1',  contact.address);
  setIfUndef('address_line2',  contact.address2);
  setIfUndef('city',           contact.city);
  setIfUndef('state',          contact.state);
  setIfUndef('postal_code',    contact.postal);
  if (contact.latitude  !== undefined && contact.latitude  !== null && contact.latitude  !== '') setIfUndef('latitude',  contact.latitude);
  if (contact.longitude !== undefined && contact.longitude !== null && contact.longitude !== '') setIfUndef('longitude', contact.longitude);

  (patch as any).data = nextData;
  return patch;
}
