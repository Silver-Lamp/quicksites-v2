// app/api/public/restaurant-directory/route.ts
//
// Public read for the restaurants_directory block: the live contest cohort for a
// restaurant domain-competition (?campaign=<id>), winner featured first. Same data
// the apex directory page renders — public by design (it IS the public directory),
// rate-limited per IP like the other public endpoints.
import { NextRequest, NextResponse } from 'next/server';
import { loadCompetitionDirectoryByCampaignId } from '@/lib/outreach/restaurantCompetitionDirectory';
import { rateLimitOr429 } from '@/lib/api/rateLimitGuard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const limited = await rateLimitOr429(req, 'restaurant-directory', 60, 60);
  if (limited) return limited;

  const campaignId = new URL(req.url).searchParams.get('campaign') || '';
  if (!campaignId) return NextResponse.json({ error: 'campaign is required' }, { status: 400 });

  const dir = await loadCompetitionDirectoryByCampaignId(campaignId);
  if (!dir) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  // Shape matches the block's `entries` schema (snake_case hero_url).
  return NextResponse.json({
    campaignId: dir.campaignId,
    city: dir.city,
    region: dir.region,
    domain: dir.domain,
    hasWinner: dir.hasWinner,
    entries: dir.entries.map((e) => ({
      template_id: e.templateId,
      slug: e.slug,
      business_name: e.businessName,
      url: e.url,
      hero_url: e.heroUrl ?? '',
      is_winner: e.isWinner,
    })),
  });
}
