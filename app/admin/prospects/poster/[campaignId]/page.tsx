// app/admin/prospects/poster/[campaignId]/page.tsx
//
// Printable "first to claim <domain> wins" competition poster for a geo-industry
// campaign. Admin-gated. The QR encodes the tokenized claim link; print it as a
// leave-behind, or it doubles as the Lob postcard artwork.

import Link from 'next/link';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { getGeoCampaign } from '@/lib/outreach/geoCampaigns';
import { listProspectsByCampaign } from '@/lib/outreach/prospects';
import { buildPosterModel, renderPosterHtml, renderPosterBackHtml } from '@/lib/outreach/competitionPoster';
import { listMailingsByCampaign } from '@/lib/outreach/mail/mailings';
import PosterFrame from '@/components/admin/poster-frame';

const STATUS_LABEL: Record<string, string> = {
  created: 'Queued',
  rendered: 'Rendered',
  in_transit: 'In transit',
  in_local_area: 'In local area',
  processed_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  re_routed: 'Re-routed',
  returned_to_sender: 'Returned',
  failed: 'Failed',
};

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
  const backHtml = renderPosterBackHtml(model);
  const mailings = await listMailingsByCampaign(campaignId).catch(() => []);
  const nameByProspect = new Map(prospects.map((p) => [p.id, p.business_name]));

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

      <p className="mb-3 text-xs text-neutral-500">
        This on-screen poster is a generic leave-behind. Cards <b>mailed via Lob</b> carry a
        per-business QR, so each scan is attributed in the delivery table below.
      </p>
      <PosterFrame html={html} backHtml={backHtml} />

      {mailings.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
            Mailed postcards — delivery &amp; scans
          </h2>
          <div className="mt-3 overflow-x-auto rounded-xl border border-neutral-800">
            <table className="min-w-full text-sm">
              <thead className="bg-neutral-900 text-left [&>tr>th]:px-4 [&>tr>th]:py-2 [&>tr>th]:font-medium [&>tr>th]:text-neutral-400">
                <tr><th>Business</th><th>Status</th><th>Est. delivery</th><th>Scans</th><th>Mailed</th></tr>
              </thead>
              <tbody className="divide-y divide-neutral-800 [&>tr>td]:px-4 [&>tr>td]:py-2">
                {mailings.map((m) => (
                  <tr key={m.id}>
                    <td>{m.to_name ?? (m.prospect_id ? nameByProspect.get(m.prospect_id) : null) ?? '—'}</td>
                    <td>
                      <span
                        className={
                          m.status === 'delivered'
                            ? 'text-emerald-400'
                            : m.status === 'returned_to_sender' || m.status === 'failed'
                            ? 'text-red-400'
                            : 'text-sky-300'
                        }
                      >
                        {STATUS_LABEL[m.status] ?? m.status}
                      </span>
                    </td>
                    <td className="text-neutral-400">{m.expected_delivery_date ?? '—'}</td>
                    <td className={m.scans > 0 ? 'font-medium text-fuchsia-300' : 'text-neutral-500'}>
                      {m.scans > 0 ? `${m.scans} scan${m.scans === 1 ? '' : 's'}` : '—'}
                    </td>
                    <td className="text-neutral-500">{new Date(m.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
