// app/api/admin/aisleask/gigs/route.ts
//
// Admin coverage + seeding for the AisleAsk gig pool.
//   GET  — list all catalog_gigs (status/search filters) + status counts + which channels each
//          gig has been cross-posted to (the coverage/management view).
//   POST — batch-create gigs from selected sweep candidates (de-duped on external_ref).
// Admin-gated; the catalog_gigs table is deny-default RLS so all access is service-role here.
// See docs/AISLEASK_OPS_PLAN.md Feature A.

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireUser';
import {
  listAllGigs,
  gigStatusCounts,
  createGigs,
  type GigStatus,
  type NewGig,
} from '@/lib/walker/gigs';
import { postsByGig } from '@/lib/walker/gigPosts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const url = new URL(req.url);
  const statusParam = url.searchParams.get('status') as GigStatus | 'all' | null;
  const status: GigStatus | 'all' =
    statusParam === 'open' || statusParam === 'claimed' || statusParam === 'completed'
      ? statusParam
      : 'all';
  const search = url.searchParams.get('q') || '';

  const [gigs, counts] = await Promise.all([listAllGigs({ status, search }), gigStatusCounts()]);
  const posts = await postsByGig(gigs.map((g) => g.id));
  const withPosts = gigs.map((g) => ({ ...g, posts: posts[g.id] ?? [] }));
  return NextResponse.json({ gigs: withPosts, counts });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const raw = Array.isArray(body?.gigs) ? body.gigs : [];
  if (!raw.length) return NextResponse.json({ error: 'No gigs to create.' }, { status: 400 });

  const num = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : undefined);
  const inputs: NewGig[] = raw
    .map((g: any) => ({
      store_name: typeof g?.store_name === 'string' ? g.store_name : '',
      address: typeof g?.address === 'string' ? g.address : undefined,
      latitude: num(g?.latitude),
      longitude: num(g?.longitude),
      location_label: typeof g?.location_label === 'string' ? g.location_label : undefined,
      source: typeof g?.source === 'string' ? g.source : 'places',
      // placeId → external_ref for cross-sweep de-dupe.
      external_ref:
        typeof g?.external_ref === 'string'
          ? g.external_ref
          : typeof g?.placeId === 'string'
            ? g.placeId
            : undefined,
      notes: typeof g?.notes === 'string' ? g.notes : undefined,
    }))
    .filter((g: NewGig) => g.store_name && g.store_name.trim())
    .slice(0, 500);

  if (!inputs.length)
    return NextResponse.json({ error: 'No valid gigs to create.' }, { status: 400 });

  const { created, skipped } = await createGigs(inputs);
  return NextResponse.json(
    { ok: true, created: created.length, skipped, gigs: created },
    { status: 201 }
  );
}
