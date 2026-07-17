// app/api/gigs/feed/route.ts
//
// Public JSON feed of open cataloging gigs — an owned, legitimately-automatable recruiting
// channel (syndicate to a job board, a Slack/Discord webhook, a partner site) with no ToS
// gymnastics. Each entry carries a public /gigs/[id] link. No auth (open gigs are public,
// same as the /gigs index); no PII beyond store name + area. See docs/AISLEASK_OPS_PLAN.md.

import { NextResponse } from 'next/server';
import { listOpenGigs } from '@/lib/walker/gigs';
import { gigPublicUrl, gigWhere, gigLocality } from '@/lib/walker/gigPost';
import { publicBaseUrl } from '@/lib/outreach/competitionPoster';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const base = publicBaseUrl();
  const gigs = await listOpenGigs(200);
  const items = gigs.map((g) => ({
    id: g.id,
    title: `Catalog a store's aisles — ${gigLocality(g)}`,
    store_name: g.store_name,
    where: gigWhere(g),
    latitude: g.latitude,
    longitude: g.longitude,
    url: gigPublicUrl(g, base),
    created_at: g.created_at,
  }));
  return NextResponse.json(
    { version: '1.0', title: 'Store-walk gigs', home_page_url: `${base}/gigs`, items },
    { headers: { 'Cache-Control': 'public, max-age=120' } }
  );
}
