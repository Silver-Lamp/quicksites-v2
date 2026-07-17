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

/** Create a gig (operator/admin seeds these — from the AisleAsk store list or by hand). */
export async function createGig(input: NewGig): Promise<Gig | null> {
  const row: any = { store_name: input.store_name.trim().slice(0, 200) };
  if (input.address) row.address = input.address.trim().slice(0, 300);
  if (Number.isFinite(input.latitude)) row.latitude = input.latitude;
  if (Number.isFinite(input.longitude)) row.longitude = input.longitude;
  if (input.location_label) row.location_label = input.location_label.trim().slice(0, 200);
  if (input.source) row.source = input.source.slice(0, 40);
  if (input.external_ref) row.external_ref = input.external_ref.slice(0, 200);
  if (input.notes) row.notes = input.notes.trim().slice(0, 1000);
  const { data } = await supabaseAdmin.from('catalog_gigs').insert(row).select(COLS).maybeSingle();
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
