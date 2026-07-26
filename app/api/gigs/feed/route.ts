// app/api/gigs/feed/route.ts
//
// Public JSON feed of open cataloging gigs — an owned, legitimately-automatable recruiting
// channel (syndicate to a job board, a Slack/Discord webhook, a partner site) with no ToS
// gymnastics. Each entry carries a public /gigs/[id] link. No auth (open gigs are public,
// same as the /gigs index); no PII beyond store name + area. See docs/AISLEASK_OPS_PLAN.md.
//
// Emits BOTH shapes from one payload:
//   - `items` — the original JSON-Feed-ish shape. Existing consumers keep working.
//   - `gigs`  — the AisleAsk partner shape (crosstalk/contracts/aisleask-catalog-gig.md,
//               "Gigs feed (read)"). HJ's listWalkerGigs() reads `json.gigs` or a bare
//               array and would silently parse `{items}` as [] — the strip just wouldn't
//               render. Keeping both keys is cheaper than versioning the endpoint.
//
// `?lat=&lng=` sorts nearest-first and adds `distance_km`. Sorting is ours because HJ's
// normalizer drops latitude/longitude, so it cannot sort client-side.

import { NextResponse } from 'next/server';
import { listOpenGigs } from '@/lib/walker/gigs';
import { gigPublicUrl, gigWhere, gigLocality } from '@/lib/walker/gigPost';
import { publicBaseUrl } from '@/lib/outreach/competitionPoster';
import { haversineDistance } from '@/lib/utils/distance';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Parse a query coordinate; returns null unless it's a real, in-range number. */
function coord(raw: string | null, max: number): number | null {
  if (raw == null || raw.trim() === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) && Math.abs(n) <= max ? n : null;
}

export async function GET(req: Request) {
  const base = publicBaseUrl();
  const url = new URL(req.url);
  const lat = coord(url.searchParams.get('lat'), 90);
  const lng = coord(url.searchParams.get('lng'), 180);
  const near = lat != null && lng != null ? { lat, lng } : null;

  const gigs = await listOpenGigs(200);

  const items = gigs.map((g) => {
    const hasCoords = Number.isFinite(g.latitude) && Number.isFinite(g.longitude);
    const distance_km =
      near && hasCoords
        ? Math.round(haversineDistance(near.lat, near.lng, g.latitude as number, g.longitude as number) * 10) / 10
        : null;
    return {
      id: g.id,
      title: `Catalog a store's aisles — ${gigLocality(g)}`,
      store_name: g.store_name,
      // `where` is the original field name; `location` is what the partner contract
      // (and HJ's normalizer, via `location ?? address`) expects. Same value.
      where: gigWhere(g),
      location: gigWhere(g),
      // v0 has no payments by design (§10 wedge posture) — explicit null beats omitting
      // it, so a consumer can tell "unpaid/unspecified" from "field missing".
      pay: null,
      latitude: g.latitude,
      longitude: g.longitude,
      distance_km,
      url: gigPublicUrl(g, base),
      created_at: g.created_at,
      posted_at: g.created_at,
    };
  });

  // Nearest-first when coords were supplied. Gigs without coordinates sort last rather
  // than being dropped — a gig with a vague address is still a real, claimable gig.
  if (near) {
    items.sort((a, b) => {
      if (a.distance_km == null && b.distance_km == null) return 0;
      if (a.distance_km == null) return 1;
      if (b.distance_km == null) return -1;
      return a.distance_km - b.distance_km;
    });
  }

  return NextResponse.json(
    {
      version: '1.1',
      title: 'Store-walk gigs',
      home_page_url: `${base}/gigs`,
      items,
      gigs: items,
    },
    { headers: { 'Cache-Control': 'public, max-age=120' } }
  );
}
