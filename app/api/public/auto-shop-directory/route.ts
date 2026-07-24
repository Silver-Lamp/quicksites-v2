// app/api/public/auto-shop-directory/route.ts
//
// Public read for the auto_shops_directory block: the live contest cohort for an
// auto-shop domain-competition (?campaign=<id>), winner featured first. Same data
// the apex directory page renders — public by design (it IS the public directory),
// rate-limited per IP like the other public endpoints.
import { NextRequest, NextResponse } from 'next/server';
import { loadAutoShopDirectoryByCampaignId } from '@/lib/outreach/autoShopCompetitionDirectory';
import { rateLimitOr429 } from '@/lib/api/rateLimitGuard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const limited = await rateLimitOr429(req, 'auto-shop-directory', 60, 60);
  if (limited) return limited;

  const campaignId = new URL(req.url).searchParams.get('campaign') || '';
  if (!campaignId) return NextResponse.json({ error: 'campaign is required' }, { status: 400 });

  const dir = await loadAutoShopDirectoryByCampaignId(campaignId);
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
