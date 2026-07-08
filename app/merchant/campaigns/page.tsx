// app/merchant/campaigns/page.tsx
//
// Merchant email campaigns (CRM_PLAN.md Phase 3): compose a message to a customer
// segment + a log of past sends. RLS-scoped — crm_campaigns_owner_read returns only
// the owner's campaigns. Sending goes through the owner-gated POST route.
import { getServerSupabase } from '@/lib/supabase/server';
import CampaignComposer from '@/components/merchant/CampaignComposer';
import { attributeOrders, ATTRIBUTION_WINDOW_DAYS } from '@/lib/crm/attribution';

export const dynamic = 'force-dynamic';

function fmtCents(c: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((c || 0) / 100);
}

// Opens/clicks: show count + rate once any engagement is recorded, else "—" (no
// webhook data yet — Resend tracking may be off or the send is too fresh).
function engagementCell(count: number | undefined, sent: number): string {
  if (!count) return '—';
  const rate = sent > 0 ? Math.round((count / sent) * 100) : 0;
  return `${count} (${rate}%)`;
}

export default async function MerchantCampaignsPage({ searchParams }: { searchParams: { merchant?: string } }) {
  const supabase = await getServerSupabase();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return <div className="p-8">Please sign in.</div>;

  const { data: merchants } = await supabase
    .from('merchants').select('id, display_name, site_slug').order('created_at');
  const merchant = merchants?.find((m) => m.id === (searchParams.merchant || merchants?.[0]?.id));
  if (!merchant) return <div className="p-8">No merchant found.</div>;

  // Tags present (for the audience tag filter) — from this merchant's customers.
  const { data: custTags } = await (supabase as any)
    .from('customers').select('tags').eq('merchant_id', merchant.id).limit(2000);
  const tagSet = new Set<string>();
  for (const c of (custTags ?? []) as any[]) for (const t of Array.isArray(c.tags) ? c.tags : []) tagSet.add(t);
  const tags = Array.from(tagSet).sort((a, b) => a.localeCompare(b));

  const { data: campaigns } = await (supabase as any)
    .from('crm_campaigns')
    .select('id, subject, status, segment, recipient_count, sent_count, failed_count, created_at, sent_at')
    .eq('merchant_id', merchant.id)
    .order('created_at', { ascending: false })
    .limit(100);

  // Attributed orders/revenue per campaign (read-time, last-touch within the window).
  // Two bounded queries → compute in JS, no per-campaign N+1.
  const campaignIds = ((campaigns ?? []) as any[]).map((c) => c.id);
  const sendsByCampaign = new Map<string, Set<string>>();
  const attribution = new Map<string, { orders: number; revenueCents: number }>();
  // Engagement per campaign (opens/clicks) from Resend webhooks.
  const engagement = new Map<string, { opens: number; clicks: number }>();
  if (campaignIds.length) {
    const { data: sends } = await (supabase as any)
      .from('crm_campaign_sends')
      .select('campaign_id, customer_id, opened_at, clicked_at')
      .in('campaign_id', campaignIds)
      .eq('status', 'sent');
    for (const s of (sends ?? []) as any[]) {
      if (s.customer_id) {
        if (!sendsByCampaign.has(s.campaign_id)) sendsByCampaign.set(s.campaign_id, new Set());
        sendsByCampaign.get(s.campaign_id)!.add(s.customer_id);
      }
      const e = engagement.get(s.campaign_id) ?? { opens: 0, clicks: 0 };
      if (s.opened_at) e.opens++;
      if (s.clicked_at) e.clicks++;
      engagement.set(s.campaign_id, e);
    }
    const { data: paidOrders } = await (supabase as any)
      .from('orders')
      .select('customer_id, created_at, total_cents')
      .eq('merchant_id', merchant.id)
      .eq('status', 'paid')
      .not('customer_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(5000);
    const attr = attributeOrders({
      campaigns: (campaigns ?? []) as any[],
      sendsByCampaign,
      orders: (paidOrders ?? []) as any[],
    });
    for (const [k, v] of attr) attribution.set(k, v);
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Campaigns</h1>
      <p className="mt-1 text-sm text-neutral-400">{merchant.display_name} • {merchant.site_slug}</p>

      <CampaignComposer merchantId={merchant.id} tags={tags} />

      <div className="mt-10 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">History</h2>
        <span className="text-xs text-neutral-500">Orders/revenue attributed within {ATTRIBUTION_WINDOW_DAYS} days of send</span>
      </div>
      <div className="mt-3 overflow-x-auto rounded-xl border border-neutral-800">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-900">
            <tr className="[&>th]:px-4 [&>th]:py-3 text-left">
              <th>When</th><th>Subject</th><th>Segment</th><th>Status</th><th className="text-right">Sent</th><th className="text-right">Opens</th><th className="text-right">Clicks</th><th className="text-right">Orders</th><th className="text-right">Revenue</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {((campaigns ?? []) as any[]).map((c) => (
              <tr key={c.id} className="[&>td]:px-4 [&>td]:py-3">
                <td className="whitespace-nowrap text-neutral-400">{new Date(c.created_at ?? '').toLocaleString()}</td>
                <td className="max-w-xs truncate">{c.subject}</td>
                <td className="text-xs text-neutral-400">
                  {c.segment?.seg ?? 'all'}{c.segment?.tag ? ` · #${c.segment.tag}` : ''}
                </td>
                <td>
                  <span className={`rounded px-2 py-1 text-xs ${
                    c.status === 'sent' ? 'bg-emerald-600/20 text-emerald-300'
                      : c.status === 'failed' ? 'bg-red-600/20 text-red-300'
                      : 'bg-neutral-700 text-neutral-300'
                  }`}>{c.status}</span>
                </td>
                <td className="text-right tabular-nums">{c.sent_count}/{c.recipient_count}</td>
                <td className="text-right tabular-nums">{engagementCell(engagement.get(c.id)?.opens, c.sent_count)}</td>
                <td className="text-right tabular-nums">{engagementCell(engagement.get(c.id)?.clicks, c.sent_count)}</td>
                <td className="text-right tabular-nums">{attribution.get(c.id)?.orders || 0}</td>
                <td className="text-right tabular-nums">{attribution.get(c.id)?.revenueCents ? fmtCents(attribution.get(c.id)!.revenueCents) : '—'}</td>
              </tr>
            ))}
            {(!campaigns || campaigns.length === 0) && (
              <tr><td className="px-4 py-6 text-neutral-500" colSpan={9}>No campaigns sent yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
