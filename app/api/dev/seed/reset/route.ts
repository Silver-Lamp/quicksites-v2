import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Any = any;
type Json = Record<string, any>;

/* ---------------- small utils ---------------- */
const msgLower = (e: Any) => `${e?.message ?? ''} ${e?.details ?? ''}`.toLowerCase();
const missingCol = (e: Any, table?: string) => {
  const m = msgLower(e);
  if (!table) return /does not exist|could not find the/.test(m);
  const a = m.match(new RegExp(`could not find the '(.+?)' column of '${table}'`));
  if (a?.[1]) return a[1];
  const b = m.match(new RegExp(`column "(.+?)" of relation "${table}" does not exist`));
  if (b?.[1]) return b[1];
  const c = m.match(new RegExp(`column ${table}\\.([a-z0-9_]+) does not exist`));
  if (c?.[1]) return c[1];
  return /does not exist|could not find the/.test(m) ? 'unknown' : null;
};
const truthy = (v?: unknown) => {
  if (typeof v === 'boolean') return v;
  const s = typeof v === 'string' ? v.toLowerCase() : '';
  return s === '1' || s === 'true' || s === 'yes' || s === 'on';
};
const toInt = (v: any) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  const i = Math.floor(n);
  return i > 0 ? i : undefined;
};
function resolveMaxDeletes(input?: number, envKey = 'SEED_MAX_DELETES'): number | undefined {
  if (typeof input === 'number' && input > 0) return Math.floor(input);
  const env = toInt(process.env[envKey as keyof NodeJS.ProcessEnv]);
  return env;
}

/* ---------------- auth / supabase server client (RLS) ---------------- */
async function serverClient() {
  const jar = await cookies();
  const supa = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieEncoding: 'base64url',
      cookies: {
        getAll: () => jar.getAll().map(({ name, value }) => ({ name, value })),
        setAll: (cks) => cks.forEach((c) => jar.set(c.name, c.value, c.options as CookieOptions | undefined)),
      },
    },
  );
  const { data } = await supa.auth.getUser();
  if (!data.user) throw new Response(JSON.stringify({ error: 'Not signed in' }), { status: 401 });
  return { supa, user: data.user };
}

/* ---------------- discover chefs owned by user ---------------- */
async function getChefsForUser(supa: Any, userId: string) {
  const chefIds = new Set<string>();
  const merchIds = new Set<string>();

  try {
    const a = await supa.from('chefs').select('id, merchant_id').eq('user_id', userId);
    if (!a.error) (a.data || []).forEach((r: Any) => { if (r?.id) chefIds.add(r.id); if (r?.merchant_id) merchIds.add(r.merchant_id); });
  } catch {}

  try {
    const m = await supa.from('merchants').select('id').eq('user_id', userId);
    if (!m.error) {
      (m.data || []).forEach((r: Any) => r?.id && merchIds.add(r.id));
      if (merchIds.size) {
        const b = await supa.from('chefs').select('id, merchant_id').in('merchant_id', Array.from(merchIds));
        if (!b.error) (b.data || []).forEach((r: Any) => { if (r?.id) chefIds.add(r.id); if (r?.merchant_id) merchIds.add(r.merchant_id); });
      }
    }
  } catch {}

  return { chefIds: Array.from(chefIds), merchIds: Array.from(merchIds) };
}

/* ---------------- storage + DB helpers ---------------- */
function parseStoragePathFromUrl(input?: string | null):
  | { bucket: string; path: string }
  | null {
  if (!input) return null;
  const url = String(input).trim();
  const m = url.match(/\/storage\/v1\/object\/(?:public|sign|download|auth)\/([^/]+)\/(.+)/i);
  if (m) {
    const bucket = m[1];
    let path = m[2];
    const q = path.indexOf('?');
    if (q >= 0) path = path.slice(0, q);
    return { bucket, path };
  }
  if (/^(profiles|meals)\//i.test(url)) {
    const bucket =
      process.env.MEAL_IMAGES_BUCKET ||
      process.env.PROFILE_IMAGES_BUCKET ||
      'public';
    return { bucket, path: url.replace(/^\/+/, '') };
  }
  return null;
}
function makeServiceClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return null;
  return createAdminClient(supabaseUrl, serviceKey);
}
async function listAllPathsRecursively(admin: ReturnType<typeof createAdminClient>, bucket: string, prefixes: string[]) {
  const paths: string[] = [];
  async function walk(prefix: string) {
    let offset = 0; const limit = 1000;
    while (true) {
      const { data, error } = await admin.storage.from(bucket).list(prefix, { limit, offset, search: '' });
      if (error) break;
      const items = data || [];
      const files = items.filter((it: Any) => !!it.id);
      const folders = items.filter((it: Any) => !it.id);
      for (const f of files) paths.push(`${prefix}${prefix.endsWith('/') ? '' : '/'}${f.name}`);
      for (const d of folders) await walk(`${prefix}${prefix.endsWith('/') ? '' : '/'}${d.name}`);
      if (items.length < limit) break;
      offset += limit;
    }
  }
  for (const p of prefixes) await walk(p.replace(/^\/+/, ''));
  return paths;
}
async function collectAllReferencedStoragePaths() {
  const admin = makeServiceClient();
  let db = admin as any;
  if (!db) {
    const { supa } = await serverClient();
    db = supa as any;
  }
  const urls: string[] = [];
  try { const q = await db.from('meals').select('photo_url'); if (!q.error) (q.data || []).forEach((r: Any) => r?.photo_url && urls.push(r.photo_url)); } catch {}
  try { const c = await db.from('chefs').select('profile_image_url'); if (!c.error) (c.data || []).forEach((r: Any) => r?.profile_image_url && urls.push(r.profile_image_url)); } catch {}
  const byBucket: Record<string, Set<string>> = {};
  for (const u of urls) {
    const p = parseStoragePathFromUrl(u);
    if (!p) continue;
    (byBucket[p.bucket] ||= new Set()).add(p.path);
  }
  return byBucket;
}

/* ---------------- filename filter (safe mode) ---------------- */
function escapeRegex(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function globToRegex(glob: string) {
  let out = '';
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i];
    if (ch === '*') out += '.*';
    else if (ch === '?') out += '.';
    else out += escapeRegex(ch);
  }
  return out;
}
type FilterOpts = {
  safeMode: boolean;
  filenamePattern?: string | null;
  patternMode?: 'regex' | 'glob';
  matchScope?: 'basename' | 'path';
  caseInsensitive?: boolean;
};
function compilePathFilter(opts: FilterOpts): ((path: string) => boolean) | null {
  if (!opts.safeMode) return null;
  const pattern = (opts.filenamePattern || '').trim();
  if (!pattern) return null;
  const mode = opts.patternMode === 'glob' ? 'glob' : 'regex';
  const scope = opts.matchScope === 'path' ? 'path' : 'basename';
  const flags = opts.caseInsensitive ? 'i' : undefined;
  if (pattern.length > 200) return null;
  const source = mode === 'glob' ? globToRegex(pattern) : pattern;
  let re: RegExp; try { re = new RegExp(source, flags as any); } catch { return null; }
  return (fullPath: string) => {
    const base = fullPath.split('/').pop() || fullPath;
    const target = scope === 'path' ? fullPath : base;
    return re.test(target);
  };
}

/* ---------------- purge engines (filter + maxDeletes aware) ---------------- */
type PurgeResult = {
  ok: boolean;
  mode: 'prefix' | 'targeted' | 'orphans';
  removed?: number;
  tried?: number;
  aborted?: boolean;
  reason?: string;
  limit?: number;
  results?: any[];
  buckets?: any;
  sample?: string[];
};

async function purgeByPrefixAcrossBuckets(opts: {
  buckets: string[];
  prefixes: string[];
  pathFilter?: (p: string) => boolean | null;
  maxDeletes?: number;
}): Promise<PurgeResult> {
  const admin = makeServiceClient();
  if (!admin) return { ok: false, mode: 'prefix', reason: 'no-admin-creds' };

  // Collect candidates first (so we can enforce the cap safely)
  const candidatesByBucket: Record<string, string[]> = {};
  let totalCandidates = 0;
  for (const bucket of opts.buckets) {
    const all = await listAllPathsRecursively(admin as any, bucket, opts.prefixes);
    const candidates = opts.pathFilter ? all.filter(opts.pathFilter) : all;
    candidatesByBucket[bucket] = candidates;
    totalCandidates += candidates.length;
  }
  if (opts.maxDeletes && totalCandidates > opts.maxDeletes) {
    return {
      ok: true,
      mode: 'prefix',
      aborted: true,
      reason: 'exceeds maxDeletes',
      limit: opts.maxDeletes,
      tried: totalCandidates,
      results: Object.entries(candidatesByBucket).map(([bucket, list]) => ({
        bucket,
        tried: list.length,
        sample: list.slice(0, 10),
      })),
    };
  }

  const results: Array<{ bucket: string; removed: number; tried: number; sample: string[] }> = [];
  let removedTotal = 0;
  for (const [bucket, list] of Object.entries(candidatesByBucket)) {
    let removed = 0;
    for (let i = 0; i < list.length; i += 900) {
      const chunk = list.slice(i, i + 900);
      const { data: rmData, error: rmErr } = await admin.storage.from(bucket).remove(chunk);
      if (!rmErr) removed += (rmData || []).length;
    }
    removedTotal += removed;
    results.push({ bucket, removed, tried: list.length, sample: list.slice(0, 10) });
  }
  return { ok: true, mode: 'prefix', removed: removedTotal, tried: totalCandidates, results };
}

async function purgeTargetedStorage(opts: {
  items: Array<{ bucket: string; path: string }>;
  onlyBuckets?: Set<string>;
  pathFilter?: (p: string) => boolean | null;
  maxDeletes?: number;
}): Promise<PurgeResult> {
  const admin = makeServiceClient();
  if (!admin) return { ok: false, mode: 'targeted', reason: 'no-admin-creds' };

  const raw = opts.items.filter(i => i.bucket && i.path && (!opts.onlyBuckets || opts.onlyBuckets.has(i.bucket)));
  const filtered = opts.pathFilter ? raw.filter(i => opts.pathFilter!(i.path)) : raw;

  if (opts.maxDeletes && filtered.length > opts.maxDeletes) {
    return {
      ok: true,
      mode: 'targeted',
      aborted: true,
      reason: 'exceeds maxDeletes',
      limit: opts.maxDeletes,
      tried: filtered.length,
      buckets: { sample: filtered.slice(0, 10) },
    };
  }

  const byBucket: Record<string, string[]> = {};
  for (const it of filtered) (byBucket[it.bucket] ||= []).push(it.path);

  let tried = 0, removed = 0;
  const results: Record<string, { tried: number; removed: number; sample: string[] }> = {};
  for (const [bucket, pathsAll] of Object.entries(byBucket)) {
    const paths = Array.from(new Set(pathsAll));
    tried += paths.length;
    let bucketRemoved = 0;
    for (let i = 0; i < paths.length; i += 900) {
      const chunk = paths.slice(i, i + 900);
      const { data: rmData, error: rmErr } = await admin.storage.from(bucket).remove(chunk);
      if (!rmErr) bucketRemoved += (rmData || []).length;
    }
    removed += bucketRemoved;
    results[bucket] = { tried: paths.length, removed: bucketRemoved, sample: paths.slice(0, 10) };
  }

  return { ok: true, mode: 'targeted', removed, tried, buckets: results };
}

async function purgeOrphansAcrossBuckets(opts: {
  buckets: string[];
  prefixes: string[];
  pathFilter?: (p: string) => boolean | null;
  maxDeletes?: number;
}): Promise<PurgeResult> {
  const admin = makeServiceClient();
  if (!admin) return { ok: false, mode: 'orphans', reason: 'no-admin-creds' };

  const referencedByBucket = await collectAllReferencedStoragePaths();

  // Collect candidates first
  const candidatesByBucket: Record<string, string[]> = {};
  let totalCandidates = 0;
  for (const bucket of opts.buckets) {
    const all = await listAllPathsRecursively(admin as any, bucket, opts.prefixes);
    const ref = referencedByBucket[bucket] || new Set<string>();
    const orphans = all.filter((p) => !ref.has(p));
    const candidates = opts.pathFilter ? orphans.filter(opts.pathFilter) : orphans;
    candidatesByBucket[bucket] = candidates;
    totalCandidates += candidates.length;
  }
  if (opts.maxDeletes && totalCandidates > opts.maxDeletes) {
    return {
      ok: true,
      mode: 'orphans',
      aborted: true,
      reason: 'exceeds maxDeletes',
      limit: opts.maxDeletes,
      tried: totalCandidates,
      results: Object.entries(candidatesByBucket).map(([bucket, list]) => ({
        bucket,
        tried: list.length,
        sample: list.slice(0, 10),
      })),
    };
  }

  // Execute delete
  const results: Array<{ bucket: string; removed: number; tried: number; sample: string[] }> = [];
  let removedTotal = 0;
  for (const [bucket, list] of Object.entries(candidatesByBucket)) {
    let removed = 0;
    for (let i = 0; i < list.length; i += 900) {
      const chunk = list.slice(i, i + 900);
      const { data: rmData, error: rmErr } = await admin.storage.from(bucket).remove(chunk);
      if (!rmErr) removed += (rmData || []).length;
    }
    removedTotal += removed;
    results.push({ bucket, removed, tried: list.length, sample: list.slice(0, 10) });
  }
  return { ok: true, mode: 'orphans', removed: removedTotal, tried: totalCandidates, results };
}

/* ---------------- targeted reference collection for CURRENT user ---------------- */
async function collectReferencedStorageForUser(
  supa: Any,
  chefIds: string[],
  merchIds: string[],
  opts: { keepMeals?: boolean; keepProfile?: boolean }
) {
  const mealUrls: string[] = [];
  const chefUrls: string[] = [];

  if (!truthy(opts.keepMeals) && chefIds.length) {
    try { const q = await supa.from('meals' as Any).select('photo_url, chef_id').in('chef_id', chefIds); if (!q.error) (q.data || []).forEach((r: Any) => r?.photo_url && mealUrls.push(r.photo_url)); } catch {}
  }
  if (!truthy(opts.keepMeals) && merchIds.length) {
    try { const q = await supa.from('meals' as Any).select('photo_url, merchant_id').in('merchant_id', merchIds); if (!q.error) (q.data || []).forEach((r: Any) => r?.photo_url && mealUrls.push(r.photo_url)); } catch {}
  }
  if (!truthy(opts.keepProfile)) {
    try { if (chefIds.length) { const c = await supa.from('chefs').select('profile_image_url').in('id', chefIds); if (!c.error) (c.data || []).forEach((r: Any) => r?.profile_image_url && chefUrls.push(r.profile_image_url)); } } catch {}
  }

  const parsed = (urls: string[]) =>
    Array.from(new Set(urls.map((u) => parseStoragePathFromUrl(u)).filter(Boolean) as Array<{ bucket: string; path: string }>));

  return { meals: parsed(mealUrls), chefs: parsed(chefUrls) };
}

/* ---------------- config & sanitation ---------------- */
const DEFAULT_PREFIXES = ['profiles/ai-avatars/', 'meals/generated/'];

function sanitizePrefix(raw: string): string | null {
  let p = (raw || '').trim();
  if (!p) return null;
  p = p.replace(/^\/+/, '');
  if (p.includes('..')) return null;
  if (!/^[a-zA-Z0-9._\-\/]+$/.test(p)) return null;
  if (!p.endsWith('/')) p += '/';
  if (p.length > 200) return null;
  return p;
}
function resolvePrefixes(extra?: string[] | null, includeDefaults = true) {
  const envExtras = (process.env.SEED_PURGE_EXTRA_PREFIXES || '').split(',').map((s) => s.trim()).filter(Boolean);
  const base = includeDefaults ? DEFAULT_PREFIXES.slice() : [];
  const all = [...base, ...envExtras, ...(extra || [])];
  return Array.from(new Set(all.map(sanitizePrefix).filter(Boolean) as string[]));
}
function resolveBuckets(buckets?: string[] | null) {
  const envBuckets = (process.env.SEED_PURGE_BUCKETS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const fallbacks = [process.env.MEAL_IMAGES_BUCKET, process.env.PROFILE_IMAGES_BUCKET, 'public'].filter(Boolean) as string[];
  const raw = (buckets && buckets.length ? buckets : envBuckets.length ? envBuckets : fallbacks);
  const clean = Array.from(new Set(raw.filter((b) => !!b).map((b) => b!.trim()).filter((b) => /^[a-zA-Z0-9._-]{1,50}$/.test(b!))));
  return clean.length ? clean : ['public'];
}

/* ---------------- core runner ---------------- */
async function runReset(req: NextRequest, params: {
  dryRun?: boolean;
  keepMeals?: boolean;
  keepProfile?: boolean;
  purgeStorage?: boolean;
  purgeMode?: 'prefix' | 'targeted' | 'orphans';
  buckets?: string[] | null;
  extraPrefixes?: string[] | null;
  includeDefaults?: boolean;

  // safe mode / filename filter
  safeMode?: boolean;
  filenamePattern?: string | null;
  patternMode?: 'regex' | 'glob';
  matchScope?: 'basename' | 'path';
  caseInsensitive?: boolean;

  // NEW: hard cap
  maxDeletes?: number;
}) {
  const { supa, user } = await serverClient();
  const { chefIds, merchIds } = await getChefsForUser(supa, user.id);

  // counts
  let mealCount = 0;
  try { const c1 = await supa.from('meals' as Any).select('id', { count: 'exact', head: true }).in('chef_id', chefIds); if (!c1.error && typeof c1.count === 'number') mealCount += c1.count || 0; } catch {}
  try { const c2 = await supa.from('meals' as Any).select('id', { count: 'exact', head: true }).in('merchant_id', merchIds); if (!c2.error && typeof c2.count === 'number') mealCount += c2.count || 0; } catch {}

  const buckets = resolveBuckets(params.buckets || null);
  const prefixes = resolvePrefixes(params.extraPrefixes || null, params.includeDefaults !== false);
  const maxDeletes = resolveMaxDeletes(params.maxDeletes);

  // filename filter
  const filter = compilePathFilter({
    safeMode: !!(params.safeMode || (params.filenamePattern && params.filenamePattern.length)),
    filenamePattern: params.filenamePattern,
    patternMode: params.patternMode,
    matchScope: params.matchScope,
    caseInsensitive: params.caseInsensitive,
  });

  // targeted refs (pre-delete)
  let targeted: { meals: Array<{bucket:string;path:string}>, chefs: Array<{bucket:string;path:string}> } | undefined;
  if (truthy(params.purgeStorage) && params.purgeMode === 'targeted') {
    targeted = await collectReferencedStorageForUser(supa, chefIds, merchIds, { keepMeals: params.keepMeals, keepProfile: params.keepProfile });
  }

  const preview = {
    user_id: user.id,
    chefs: chefIds,
    merchants: merchIds,
    mealCount,
    config: {
      purgeMode: params.purgeMode || 'prefix',
      buckets,
      prefixes,
      safeMode: !!(params.safeMode || (params.filenamePattern && params.filenamePattern.length)),
      filenamePattern: params.filenamePattern || null,
      patternMode: params.patternMode || 'regex',
      matchScope: params.matchScope || 'basename',
      caseInsensitive: !!params.caseInsensitive,
      maxDeletes: maxDeletes ?? null,
    },
  };

  // ---- Dry run previews ----
  if (truthy(params.dryRun)) {
    let storagePreview: Json | undefined;
    if (truthy(params.purgeStorage)) {
      if (params.purgeMode === 'targeted') {
        const only = new Set(buckets);
        const raw = [...(targeted?.meals ?? []), ...(targeted?.chefs ?? [])].filter(i => only.has(i.bucket));
        const items = filter ? raw.filter(i => filter(i.path)) : raw;
        storagePreview = { mode: 'targeted', totals: { items: items.length }, wouldAbort: !!(maxDeletes && items.length > maxDeletes), limit: maxDeletes ?? null, sample: items.slice(0, 10) };
      } else {
        const admin = makeServiceClient();
        if (!admin) storagePreview = { mode: params.purgeMode || 'prefix', reason: 'no-admin-creds' };
        else {
          let total = 0;
          const perBucket: Any[] = [];
          if (params.purgeMode === 'orphans') {
            const referencedByBucket = await collectAllReferencedStoragePaths();
            for (const bucket of buckets) {
              const all = await listAllPathsRecursively(admin as any, bucket, prefixes);
              const ref = referencedByBucket[bucket] || new Set<string>();
              const orphans = all.filter((p) => !ref.has(p));
              const candidates = filter ? orphans.filter(filter) : orphans;
              total += candidates.length;
              perBucket.push({ bucket, tried: candidates.length, sample: candidates.slice(0, 10) });
            }
            storagePreview = { mode: 'orphans', limit: maxDeletes ?? null, wouldAbort: !!(maxDeletes && total > maxDeletes), buckets: perBucket };
          } else {
            // prefix
            for (const bucket of buckets) {
              const all = await listAllPathsRecursively(admin as any, bucket, prefixes);
              const candidates = filter ? all.filter(filter) : all;
              total += candidates.length;
              perBucket.push({ bucket, tried: candidates.length, sample: candidates.slice(0, 10) });
            }
            storagePreview = { mode: 'prefix', limit: maxDeletes ?? null, wouldAbort: !!(maxDeletes && total > maxDeletes), buckets: perBucket };
          }
        }
      }
    }
    return NextResponse.json({ ok: true, mode: 'preview', ...preview, storage: storagePreview });
  }

  // ---- delete meals (RLS-aware) ----
  if (!truthy(params.keepMeals)) {
    if (chefIds.length) {
      const del1 = await supa.from('meals' as Any).delete().in('chef_id', chefIds);
      if (del1.error && !missingCol(del1.error, 'meals')) {
        if (msgLower(del1.error).includes('row-level security')) {
          return NextResponse.json({ error: 'RLS blocked meal delete by chef_id. Ensure policy allows a chef to delete their meals.' }, { status: 403 });
        }
      }
    }
    if (merchIds.length) {
      const del2 = await supa.from('meals' as Any).delete().in('merchant_id', merchIds);
      if (del2.error && !missingCol(del2.error, 'meals')) {
        if (msgLower(del2.error).includes('row-level security')) {
          return NextResponse.json({ error: 'RLS blocked meal delete by merchant_id. Ensure policy allows a chef to delete their meals.' }, { status: 403 });
        }
      }
    }
  }

  // ---- delete chefs (RLS-aware) ----
  if (!truthy(params.keepProfile) && chefIds.length) {
    const delC = await supa.from('chefs' as Any).delete().in('id', chefIds);
    if (delC.error) {
      if (msgLower(delC.error).includes('row-level security')) {
        return NextResponse.json({ error: 'RLS blocked chef delete. Ensure policy allows a chef to delete their own row.' }, { status: 403 });
      }
      return NextResponse.json({ error: delC.error.message || 'Chef delete failed' }, { status: 500 });
    }
  }

  // ---- storage purge ----
  let storage: PurgeResult | undefined;
  if (truthy(params.purgeStorage)) {
    if (params.purgeMode === 'targeted') {
      const only = new Set(buckets);
      const items = [...(targeted?.meals ?? []), ...(targeted?.chefs ?? [])];
      storage = await purgeTargetedStorage({ items, onlyBuckets: only, pathFilter: filter || undefined, maxDeletes });
    } else if (params.purgeMode === 'orphans') {
      storage = await purgeOrphansAcrossBuckets({ buckets, prefixes, pathFilter: filter || undefined, maxDeletes });
    } else {
      storage = await purgeByPrefixAcrossBuckets({ buckets, prefixes, pathFilter: filter || undefined, maxDeletes });
    }
  }

  // If purge aborted, still return 200 but include aborted info
  const aborted = !!storage?.aborted;
  return NextResponse.json({ ok: !aborted, mode: 'deleted', aborted, ...preview, storage });
}

/* ---------------- HTTP handlers ---------------- */
function parseCsv(q: URLSearchParams, key: string): string[] {
  const single = q.get(key);
  const many = q.getAll(key);
  const list: string[] = [];
  if (single) list.push(...single.split(',').map((s)=>s.trim()).filter(Boolean));
  if (many.length > 1) for (const m of many) list.push(...m.split(',').map((s)=>s.trim()).filter(Boolean));
  return Array.from(new Set(list));
}

export async function DELETE(req: NextRequest) {
  const u = new URL(req.url);
  const q = u.searchParams;

  const dryRun = truthy(q.get('dryRun'));
  const keepMeals = truthy(q.get('keepMeals'));
  const keepProfile = truthy(q.get('keepProfile'));
  const purgeStorage = truthy(q.get('purgeStorage'));

  const pm = (q.get('purgeMode') || '').toLowerCase();
  const purgeMode: 'prefix' | 'targeted' | 'orphans' =
    pm === 'targeted' ? 'targeted' : pm === 'orphans' ? 'orphans' : 'prefix';

  // multi-bucket & extra prefixes
  const buckets = parseCsv(q, 'buckets');
  const bucketSingle = q.get('bucket'); if (bucketSingle) buckets.push(bucketSingle);
  const extraPrefixes = parseCsv(q, 'extraPrefixes');
  const includeDefaults = q.get('includeDefaults') == null ? true : truthy(q.get('includeDefaults'));

  // safe mode options
  const safeMode = q.get('safeMode') == null
    ? !!(q.get('filenamePattern') && q.get('filenamePattern')!.length)
    : truthy(q.get('safeMode'));
  const filenamePattern = q.get('filenamePattern') || null;
  const patternMode = (q.get('patternMode') === 'glob' ? 'glob' : 'regex') as 'regex' | 'glob';
  const matchScope = (q.get('matchScope') === 'path' ? 'path' : 'basename') as 'basename' | 'path';
  const caseInsensitive = truthy(q.get('caseInsensitive'));

  // NEW: maxDeletes guard
  const maxDeletes = resolveMaxDeletes(toInt(q.get('maxDeletes') || undefined));

  return runReset(req, {
    dryRun, keepMeals, keepProfile, purgeStorage, purgeMode,
    buckets, extraPrefixes, includeDefaults,
    safeMode, filenamePattern, patternMode, matchScope, caseInsensitive,
    maxDeletes,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as Any));
  const purgeMode: 'prefix' | 'targeted' | 'orphans' =
    body?.purgeMode === 'targeted' ? 'targeted' : body?.purgeMode === 'orphans' ? 'orphans' : 'prefix';

  const safeMode = body?.safeMode ?? !!(body?.filenamePattern && String(body.filenamePattern).length);

  const maxDeletes = resolveMaxDeletes(
    typeof body?.maxDeletes === 'number' ? body.maxDeletes : toInt(body?.maxDeletes),
  );

  return runReset(req, {
    dryRun: truthy(body?.dryRun),
    keepMeals: truthy(body?.keepMeals),
    keepProfile: truthy(body?.keepProfile),
    purgeStorage: truthy(body?.purgeStorage),
    purgeMode,
    buckets: Array.isArray(body?.buckets) ? body.buckets : undefined,
    extraPrefixes: Array.isArray(body?.extraPrefixes) ? body.extraPrefixes : undefined,
    includeDefaults: body?.includeDefaults !== undefined ? !!body.includeDefaults : undefined,

    safeMode,
    filenamePattern: typeof body?.filenamePattern === 'string' ? body.filenamePattern : undefined,
    patternMode: body?.patternMode === 'glob' ? 'glob' : 'regex',
    matchScope: body?.matchScope === 'path' ? 'path' : 'basename',
    caseInsensitive: !!body?.caseInsensitive,

    maxDeletes,
  });
}
