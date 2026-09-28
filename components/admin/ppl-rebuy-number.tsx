'use client';

// components/admin/ppl-rebuy-number.tsx
//
// "Rebuy local" — replace a tracking number whose area code does not match its market.
//
// ⚠️ HOW "NOT LOCAL" IS DECIDED, AND WHY IT IS NOT A LOOKUP TABLE. The comparison is the
// tracking number's area code against the FORWARD-TO's area code. The forward-to is a real
// business in that market, so its area code is the market's by definition — no mapping of codes
// to states to maintain, and no guessing about overlays (938 really is Cullman's, 253 really
// does serve Renton). The same data-derived trick the forward-to recommender uses.
//
// It catches the case it was built for: seatac-towing.com holds a 419 (Toledo, Ohio) number
// while forwarding to a 206 business.
//
// ⚠️ Shown as a WARNING, never auto-actioned. Adjacent area codes are common and fine —
// maplevalley forwards to 206 and holds 206; renton-towing forwards to 253 and holds 253. A
// mismatch is worth a person's glance, not an automatic purchase.
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const area = (p?: string | null) => {
  const d = String(p ?? '').replace(/\D/g, '').replace(/^1/, '');
  return d.length === 10 ? d.slice(0, 3) : '';
};

export function isAreaCodeMismatch(trackingNumber?: string | null, forwardTo?: string | null) {
  const t = area(trackingNumber);
  const f = area(forwardTo);
  return !!t && !!f && t !== f;
}

export default function PplRebuyNumber({
  campaignId,
  domain,
  trackingNumber,
  forwardTo,
  enabled,
}: {
  campaignId: string;
  domain: string;
  trackingNumber: string;
  forwardTo: string | null;
  enabled: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (!isAreaCodeMismatch(trackingNumber, forwardTo)) return null;

  async function run() {
    if (
      !window.confirm(
        `Replace ${trackingNumber} on ${domain} with a number local to ${area(forwardTo)}?\n\n` +
          `• Buys the replacement FIRST, then releases ${trackingNumber}\n` +
          `• If no local number is available, nothing changes and nothing is spent\n` +
          `• The business is NOT texted again — they were told once already\n` +
          `• Net cost stays ~$1.15/month; you are swapping, not adding`,
      )
    )
      return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch('/api/admin/prospects/geo-campaign/rebuy-number', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId }),
      });
      const j = await r.json();
      if (!r.ok) {
        // 409 = no local inventory. Nothing changed; say so rather than reading as a failure.
        setMsg(
          j.code === 'no_local_inventory'
            ? `No local number available — kept ${j.kept}. Nothing spent.`
            : j.error || r.statusText,
        );
        return;
      }
      const site = j.site?.ok ? 'site updated' : `⚠️ SITE NOT UPDATED${j.site?.warning ? ` — ${j.site.warning}` : ''}`;
      setMsg(
        `${j.number} (was ${j.previous}${j.released ? ', released' : ', ⚠️ NOT released — still billing'}); ${site}` +
          (j.locality && j.locality !== 'area_code' ? ` ⚠️ still not an exact area-code match (${j.locality})` : ''),
      );
      router.refresh();
    } catch (e: any) {
      setMsg(e?.message || 'failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-200">
        {area(trackingNumber)} ≠ {area(forwardTo)} local
      </span>
      <button
        type="button"
        onClick={run}
        disabled={!enabled || busy}
        title={enabled ? 'Buy a local replacement, then release this one' : 'Call tracking is off'}
        className={
          enabled
            ? 'rounded-md border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-200 hover:bg-sky-500/20 disabled:opacity-50'
            : 'cursor-not-allowed rounded-md border border-border px-2 py-0.5 text-[11px] text-muted-foreground'
        }
      >
        {busy ? 'Swapping…' : 'Rebuy local'}
      </button>
      {msg ? <span className="text-[11px] text-muted-foreground">{msg}</span> : null}
    </span>
  );
}
