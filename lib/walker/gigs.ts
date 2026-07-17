// lib/walker/gigs.ts
//
// Data access for the AisleAsk store-walk gig board (catalog_gigs). Service-role only
// (the table is deny-default RLS); every caller is an authed server route that passes the
// tasker's user id. Claims are race-safe (conditional update on status), so two taskers
// can't grab the same gig. v0 has NO payments (§10 wedge posture).

import { supabaseAdmin } from '@/lib/supabase/admin';

export type Gig = {
  id: string;
  store_name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  location_label: string | null;
  status: 'open' | 'claimed' | 'completed';
  claimed_by: string | null;
  claimed_at: string | null;
  completed_at: string | null;
  source: string;
  notes: string | null;
  created_at: string;
};

const COLS = 'id, store_name, address, latitude, longitude, location_label, status, claimed_by, claimed_at, completed_at, source, notes, created_at';

/** Open (unclaimed) gigs — the pool a tasker picks from. */
export async function listOpenGigs(limit = 100): Promise<Gig[]> {
  const { data } = await supabaseAdmin
    .from('catalog_gigs')
    .select(COLS)
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(Math.min(200, Math.max(1, limit)));
  return (data as Gig[]) ?? [];
}

/** The caller's claimed + recently-completed gigs — "my walk today". */
export async function listMyGigs(userId: string): Promise<Gig[]> {
  const { data } = await supabaseAdmin
    .from('catalog_gigs')
    .select(COLS)
    .eq('claimed_by', userId)
    .in('status', ['claimed', 'completed'])
    .order('claimed_at', { ascending: true })
    .limit(200);
  return (data as Gig[]) ?? [];
}

/** Claim an OPEN gig — conditional on status='open' so two taskers can't both win. */
export async function claimGig(id: string, userId: string): Promise<Gig | null> {
  const { data } = await supabaseAdmin
    .from('catalog_gigs')
    .update({ status: 'claimed', claimed_by: userId, claimed_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'open')
    .select(COLS)
    .maybeSingle();
  return (data as Gig) ?? null;
}

/** Release a gig back to the pool — only if the caller holds it. */
export async function releaseGig(id: string, userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('catalog_gigs')
    .update({ status: 'open', claimed_by: null, claimed_at: null })
    .eq('id', id)
    .eq('claimed_by', userId)
    .eq('status', 'claimed')
    .select('id')
    .maybeSingle();
  return !!data;
}

/** Mark a gig completed — only if the caller holds it. */
export async function completeGig(id: string, userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('catalog_gigs')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', id)
    .eq('claimed_by', userId)
    .eq('status', 'claimed')
    .select('id')
    .maybeSingle();
  return !!data;
}

export type NewGig = {
  store_name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  location_label?: string;
  source?: string;
  external_ref?: string;
  notes?: string;
};

/** Normalize a NewGig into an insertable row (shared by createGig + createGigs). */
function toRow(input: NewGig): Record<string, unknown> {
  const row: Record<string, unknown> = { store_name: input.store_name.trim().slice(0, 200) };
  if (input.address) row.address = input.address.trim().slice(0, 300);
  if (Number.isFinite(input.latitude)) row.latitude = input.latitude;
  if (Number.isFinite(input.longitude)) row.longitude = input.longitude;
  if (input.location_label) row.location_label = input.location_label.trim().slice(0, 200);
  if (input.source) row.source = input.source.slice(0, 40);
  if (input.external_ref) row.external_ref = input.external_ref.slice(0, 200);
  if (input.notes) row.notes = input.notes.trim().slice(0, 1000);
  return row;
}

/** Create a gig (operator/admin seeds these — from the AisleAsk store list or by hand). */
export async function createGig(input: NewGig): Promise<Gig | null> {
  const { data } = await supabaseAdmin.from('catalog_gigs').insert(toRow(input)).select(COLS).maybeSingle();
  return (data as Gig) ?? null;
}

/**
 * Batch-seed gigs from a coverage plan (a store sweep). De-dupes on `external_ref` against
 * gigs that already exist (a re-sweep of the same city never double-creates a store), and
 * drops in-batch dupes too. Returns the rows created + how many were skipped as dupes.
 */
export async function createGigs(
  inputs: NewGig[],
): Promise<{ created: Gig[]; skipped: number }> {
  const named = inputs.filter((i) => i.store_name && i.store_name.trim());
  if (!named.length) return { created: [], skipped: 0 };

  // 1) Which external_refs already exist? (only those carrying one can be deduped)
  const refs = [...new Set(named.map((i) => i.external_ref).filter(Boolean) as string[])];
  const existing = new Set<string>();
  if (refs.length) {
    const { data } = await supabaseAdmin
      .from('catalog_gigs')
      .select('external_ref')
      .in('external_ref', refs);
    for (const r of (data as { external_ref: string | null }[]) ?? []) {
      if (r.external_ref) existing.add(r.external_ref);
    }
  }

  // 2) Filter out already-present refs + in-batch dupes.
  const seen = new Set<string>();
  const toInsert: NewGig[] = [];
  let skipped = 0;
  for (const i of named) {
    const ref = i.external_ref;
    if (ref) {
      if (existing.has(ref) || seen.has(ref)) { skipped++; continue; }
      seen.add(ref);
    }
    toInsert.push(i);
  }
  if (!toInsert.length) return { created: [], skipped };

  const { data } = await supabaseAdmin
    .from('catalog_gigs')
    .insert(toInsert.map(toRow))
    .select(COLS);
  return { created: (data as Gig[]) ?? [], skipped };
}

export type GigStatus = 'open' | 'claimed' | 'completed';

/** One gig by id (public gig page + admin management both use this). */
export async function getGig(id: string): Promise<Gig | null> {
  const { data } = await supabaseAdmin.from('catalog_gigs').select(COLS).eq('id', id).maybeSingle();
  return (data as Gig) ?? null;
}

/**
 * Admin coverage view — all gigs, optionally filtered by status + a free-text match on
 * store name / address / location label. Newest first.
 */
export async function listAllGigs(opts: {
  status?: GigStatus | 'all';
  search?: string;
  limit?: number;
} = {}): Promise<Gig[]> {
  let q = supabaseAdmin.from('catalog_gigs').select(COLS).order('created_at', { ascending: false });
  if (opts.status && opts.status !== 'all') q = q.eq('status', opts.status);
  const search = (opts.search || '').trim();
  if (search) {
    const like = `%${search.replace(/[%,]/g, ' ')}%`;
    q = q.or(`store_name.ilike.${like},address.ilike.${like},location_label.ilike.${like}`);
  }
  const { data } = await q.limit(Math.min(1000, Math.max(1, opts.limit ?? 500)));
  return (data as Gig[]) ?? [];
}

/** Status counts for the coverage dashboard. */
export async function gigStatusCounts(): Promise<{ open: number; claimed: number; completed: number; total: number }> {
  const gigs = await listAllGigs({ limit: 1000 });
  const c = { open: 0, claimed: 0, completed: 0, total: gigs.length };
  for (const g of gigs) c[g.status] += 1;
  return c;
}

/**
 * Admin: close (→ 'completed') or reopen (→ 'open') a gig, and/or edit its notes. Closing
 * clears any claim; reopening returns it to the pool. This is operator management, distinct
 * from a tasker's own complete/release (which are scoped to the holder in claimGig/etc.).
 */
export async function adminUpdateGig(
  id: string,
  patch: { status?: 'open' | 'completed'; notes?: string; location_label?: string },
): Promise<Gig | null> {
  const update: Record<string, unknown> = {};
  if (patch.status === 'completed') {
    update.status = 'completed';
    update.completed_at = new Date().toISOString();
  } else if (patch.status === 'open') {
    update.status = 'open';
    update.claimed_by = null;
    update.claimed_at = null;
    update.completed_at = null;
  }
  if (typeof patch.notes === 'string') update.notes = patch.notes.trim().slice(0, 1000) || null;
  if (typeof patch.location_label === 'string') update.location_label = patch.location_label.trim().slice(0, 200) || null;
  if (!Object.keys(update).length) return getGig(id);
  const { data } = await supabaseAdmin.from('catalog_gigs').update(update).eq('id', id).select(COLS).maybeSingle();
  return (data as Gig) ?? null;
}

/**
 * Build a route-planner deep-link from a set of gigs — coords become "Name @lat,lng"
 * (exact, no geocode), else the address/location label (best-effort geocode). This is the
 * hands-free hop: a tasker's claimed gigs → one tap → an optimized store-walk route.
 */
export function planRouteUrl(gigs: Gig[]): string {
  const stops = gigs
    .map((g) => {
      const name = g.store_name.replace(/[|@]/g, ' ').trim();
      if (Number.isFinite(g.latitude) && Number.isFinite(g.longitude)) return `${name} @${g.latitude},${g.longitude}`;
      const addr = (g.address || g.location_label || '').replace(/\|/g, ' ').trim();
      return addr ? `${name}, ${addr}` : '';
    })
    .filter(Boolean);
  return `/tools/route-planner?stops=${encodeURIComponent(stops.join('|'))}`;
}
