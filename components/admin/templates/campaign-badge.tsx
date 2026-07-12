// components/admin/templates/campaign-badge.tsx
//
// Surfaces "this template is a geo-domain campaign pitch site" on the templates list
// (grid + table). Links to the prospects console. The richer editor banner lives in
// geo-campaign-banner.tsx.

import { MapPin } from 'lucide-react';

export type CampaignInfo = {
  id?: string;
  domain: string;
  status?: string | null;
  domain_status?: string | null;
  rank_status?: string | null;
  city?: string | null;
  industry_key?: string | null;
  pricing_model?: string | null;
  price_cents?: number | null;
  locked_rate_cents?: number | null;
  subscription_status?: string | null;
  tracking_number?: string | null;
};

export function rankLabel(s?: string | null): string | null {
  if (s === 'page1') return 'Page 1';
  if (s === 'ranking') return 'Ranking';
  return null;
}
export function dollars(cents?: number | null): string | null {
  return cents == null ? null : `$${Math.round(cents / 100)}`;
}

export function nextActionLabel(a?: string | null): string {
  switch (a) {
    case 'send_postcard': return 'Send postcard';
    case 'send_sms': return 'Send SMS';
    case 'call': return 'Call';
    case 'send_email': return 'Email';
    case 'reach_out_now': return 'Reach out now';
    case 'rent_pitch': return 'Pitch rental';
    case 'wait': return 'Wait';
    case 'cold': return 'Cold — move on';
    case 'nurture': return 'Nurture';
    default: return a || '—';
  }
}

/** Compact pill for the list (grid + table). */
export function CampaignBadge({ c }: { c: CampaignInfo }) {
  const rank = rankLabel(c.rank_status);
  const rented = c.subscription_status === 'active';
  return (
    <a
      href="/admin/prospects"
      onClick={(e) => e.stopPropagation()}
      title={`Geo-domain campaign · ${c.domain}${rented ? ' · rented' : ''}`}
      className="inline-flex max-w-full items-center gap-1 rounded-full border border-fuchsia-500/40 bg-fuchsia-500/10 px-2 py-0.5 text-[11px] font-medium text-fuchsia-200 hover:bg-fuchsia-500/20"
    >
      <MapPin className="h-3 w-3 shrink-0" />
      <span className="truncate">{c.domain}</span>
      {rank && <span className="shrink-0 text-emerald-300">· {rank}</span>}
      {rented && <span className="shrink-0 text-amber-300">· rented</span>}
    </a>
  );
}
