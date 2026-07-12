// components/admin/templates/geo-campaign-banner.tsx
//
// Slim banner shown above the editor when a template is a geo-domain campaign pitch
// site — so an operator editing it sees the domain, rank, plan, and status at a glance.

import Link from 'next/link';
import { MapPin } from 'lucide-react';
import type { GeoCampaignSummary } from '@/lib/outreach/geoCampaigns';
import { rankLabel, dollars, nextActionLabel } from '@/components/admin/templates/campaign-badge';

export default function GeoCampaignBanner({ c }: { c: GeoCampaignSummary }) {
  const rank = rankLabel(c.rank_status);
  const price =
    c.pricing_model === 'flat' ? `${dollars(c.locked_rate_cents) ?? '—'} → ${dollars(c.price_cents) ?? '—'}/mo` : null;
  const nextAction = c.recommendations?.nextAction ?? null;
  const topRec = Array.isArray(c.recommendations?.ranking) ? c.recommendations.ranking[0] : null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-fuchsia-500/30 bg-fuchsia-500/10 px-4 py-2 text-sm text-fuchsia-100">
      <span className="inline-flex items-center gap-1.5 font-medium">
        <MapPin className="h-4 w-4" /> Geo-domain campaign
      </span>
      <span className="font-mono text-fuchsia-200">{c.domain}</span>
      {c.city ? <span className="text-fuchsia-300/70">{c.city}</span> : null}
      {rank && <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-300">{rank}</span>}
      <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">domain: {c.domain_status}</span>
      {price && <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">{price}</span>}
      {c.subscription_status === 'active' && (
        <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-200">rented</span>
      )}
      {c.tracking_number && <span className="text-xs text-fuchsia-300/70">☎ {c.tracking_number}</span>}
      {nextAction && (
        <span className="rounded-full bg-fuchsia-500/20 px-2 py-0.5 text-xs" title={nextAction.reason}>
          Next: {nextActionLabel(nextAction.action)}
        </span>
      )}
      {topRec && <span className="hidden text-xs text-fuchsia-300/80 md:inline" title={topRec.detail}>💡 {topRec.title}</span>}
      <Link href="/admin/prospects" className="ml-auto text-xs underline underline-offset-2 hover:text-white">
        Manage in Prospects →
      </Link>
    </div>
  );
}
