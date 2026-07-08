// app/merchant/campaigns/page.tsx
//
// Merchant email campaigns (CRM_PLAN.md Phase 3): compose a message to a customer
// segment + a log of past sends. RLS-scoped — crm_campaigns_owner_read returns only
// the owner's campaigns. Sending goes through the owner-gated POST route.
import { getServerSupabase } from '@/lib/supabase/server';
import CampaignComposer from '@/components/merchant/CampaignComposer';

export const dynamic = 'force-dynamic';

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

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Campaigns</h1>
      <p className="mt-1 text-sm text-neutral-400">{merchant.display_name} • {merchant.site_slug}</p>

      <CampaignComposer merchantId={merchant.id} tags={tags} />

      <h2 className="mt-10 text-lg font-semibold">History</h2>
      <div className="mt-3 overflow-x-auto rounded-xl border border-neutral-800">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-900">
            <tr className="[&>th]:px-4 [&>th]:py-3 text-left">
              <th>When</th><th>Subject</th><th>Segment</th><th>Status</th><th className="text-right">Sent</th><th className="text-right">Failed</th>
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
                <td className="text-right tabular-nums">{c.failed_count || 0}</td>
              </tr>
            ))}
            {(!campaigns || campaigns.length === 0) && (
              <tr><td className="px-4 py-6 text-neutral-500" colSpan={6}>No campaigns sent yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
