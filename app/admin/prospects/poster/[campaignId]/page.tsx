// app/admin/prospects/poster/[campaignId]/page.tsx
//
// Printable "first to claim <domain> wins" competition poster for a geo-industry
// campaign. Admin-gated. The QR encodes the tokenized claim link; print it as a
// leave-behind, or it doubles as the Lob postcard artwork.

import Link from 'next/link';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { getGeoCampaign } from '@/lib/outreach/geoCampaigns';
import { listProspectsByCampaign } from '@/lib/outreach/prospects';
import { buildPosterModel, renderPosterHtml } from '@/lib/outreach/competitionPoster';
import PosterFrame from '@/components/admin/poster-frame';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function PosterPage({ params }: { params: Promise<{ campaignId: string }> }) {
  const admin = await getAdminUser();
  if (!admin) return <div className="p-8 text-neutral-400">Forbidden.</div>;

  const { campaignId } = await params;
  const campaign = await getGeoCampaign(campaignId);
  if (!campaign) return <div className="p-8 text-neutral-400">Campaign not found.</div>;

  const prospects = await listProspectsByCampaign(campaignId);
  const model = await buildPosterModel(campaign, prospects);
  if (!model) return <div className="p-8 text-neutral-400">This campaign has no pitch site yet.</div>;

  const html = renderPosterHtml(model);

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 text-white">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{campaign.domain}</h1>
          <p className="text-sm text-neutral-400">
            {campaign.city} · {model.industryLabel} · {model.businesses.length} competing businesses
          </p>
        </div>
        <Link href="/admin/prospects" className="text-sm text-sky-400 underline underline-offset-4">← Prospects</Link>
      </div>
      <PosterFrame html={html} />
    </div>
  );
}
