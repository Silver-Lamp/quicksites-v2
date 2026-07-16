'use client';

// components/admin/apex-domain-check.tsx
//
// Apex-domain availability check for the restaurant land-grab, shared by two surfaces:
//   - the prospects sweep (auto mode): fires as soon as a restaurant sweep lands, so the
//     operator sees "austin-restaurant.com is available — $12/yr" next to the sweep tally;
//   - the Location Domains area cards (button mode): "Check apex domain" on un-owned
//     areas, with the one-click Buy (flag-gated server-side) that flips the card to owned.
// Data: POST /api/admin/restaurant-domains/apex-search; buy: POST …/buy-apex.

import * as React from 'react';
import Link from 'next/link';

type AltResult = { domain: string; available: boolean; priceUsd: number | null; premium: boolean };

type SearchResult = {
  domain: string;
  status: 'contest' | 'owned' | 'available' | 'taken' | 'unknown';
  campaignId: string | null;
  campaignKind: string | null;
  priceUsd: number | null;
  premium: boolean;
  alt: AltResult | null;
  purchase: { enabled: boolean; registerFlag: boolean; contactReady: boolean };
  error?: string;
};

const price = (usd: number | null) => (typeof usd === 'number' ? `$${usd}/yr` : 'price unknown');

export default function ApexDomainCheck({
  city,
  region,
  domain,
  auto = false,
  showCockpitLink = false,
  onPurchased,
}: {
  city: string;
  region?: string | null;
  /** Check this exact domain (area cards pass theirs); omit to derive <city>-restaurant.com. */
  domain?: string | null;
  /** Fire the check immediately (sweep hint) instead of behind a button (area cards). */
  auto?: boolean;
  /** Append a "Location domains →" link (the tools live there). */
  showCockpitLink?: boolean;
  /** Called after a successful purchase so the parent can reload its data. */
  onPurchased?: (domain: string) => void;
}) {
  const [result, setResult] = React.useState<SearchResult | null>(null);
  const [checking, setChecking] = React.useState(false);
  const [buying, setBuying] = React.useState<string | null>(null); // domain being bought
  const [error, setError] = React.useState<string | null>(null);
  const [bought, setBought] = React.useState<string | null>(null);

  const check = React.useCallback(async () => {
    setChecking(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/restaurant-domains/apex-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city, region: region ?? undefined, domain: domain ?? undefined }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || `failed (${res.status})`);
      setResult(j.result);
    } catch (e: any) {
      setError(e?.message || 'check failed');
    } finally {
      setChecking(false);
    }
  }, [city, region, domain]);

  // Auto mode re-checks whenever the swept city changes.
  React.useEffect(() => {
    if (auto && city) void check();
  }, [auto, city, check]);

  const buy = async (target: string, expectedPriceUsd: number | null) => {
    if (!confirm(`Buy ${target}${expectedPriceUsd != null ? ` for $${expectedPriceUsd}/yr` : ''}? This spends real money and attaches the domain to the project.`)) return;
    setBuying(target);
    setError(null);
    try {
      const res = await fetch('/api/admin/restaurant-domains/buy-apex', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: target, expectedPriceUsd }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || `failed (${res.status})`);
      setBought(j.domain);
      onPurchased?.(j.domain);
    } catch (e: any) {
      setError(e?.message || 'purchase failed');
    } finally {
      setBuying(null);
    }
  };

  const buyButton = (target: string, priceUsd: number | null, premium: boolean, purchase: SearchResult['purchase']) =>
    purchase.enabled ? (
      <button
        type="button"
        disabled={!!buying}
        onClick={() => void buy(target, priceUsd)}
        className="rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50"
        title={premium ? 'Premium name — double-check the price' : `Buy ${target} via the Vercel registrar`}
      >
        {buying === target ? 'Buying…' : `Buy ${price(priceUsd)}`}
      </button>
    ) : (
      <span
        className="text-[11px] text-neutral-500"
        title={
          !purchase.registerFlag
            ? 'Set VERCEL_DOMAIN_REGISTER_ENABLED=1 to enable one-click purchase'
            : 'Set the DOMAIN_REGISTRANT_* contact env to enable one-click purchase'
        }
      >
        {price(priceUsd)} · buy disabled
      </span>
    );

  if (bought) {
    return (
      <span className="inline-flex items-center gap-2 text-xs text-emerald-300">
        🎉 Bought {bought} — attached to the project.
        {showCockpitLink && (
          <Link href="/admin/restaurant-domains" className="text-sky-400 underline underline-offset-2 hover:text-sky-300">
            Location domains →
          </Link>
        )}
      </span>
    );
  }

  if (!result) {
    return (
      <span className="inline-flex items-center gap-2">
        {!auto && (
          <button
            type="button"
            disabled={checking}
            onClick={() => void check()}
            className="rounded border border-neutral-700 px-2 py-0.5 text-[11px] text-neutral-300 hover:border-neutral-500 hover:text-white disabled:opacity-50"
            title="Check availability + price for this apex domain (Vercel registrar)"
          >
            {checking ? 'Checking…' : 'Check apex domain'}
          </button>
        )}
        {auto && checking && <span className="text-xs text-neutral-500">Checking the apex domain…</span>}
        {error && <span className="text-[11px] text-red-400">{error}</span>}
      </span>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2 text-xs">
      {result.status === 'contest' && (
        <span className="text-purple-300">
          🏁 {result.domain} — already {result.campaignKind === 'restaurant_competition' ? 'running a claim contest' : 'in a campaign'}
        </span>
      )}
      {result.status === 'owned' && <span className="text-sky-300">✓ {result.domain} — owned, no contest yet</span>}
      {result.status === 'available' && (
        <>
          <span className="font-medium text-emerald-300">🟢 {result.domain} is available{result.premium ? ' (premium)' : ''}</span>
          {buyButton(result.domain, result.priceUsd, result.premium, result.purchase)}
        </>
      )}
      {result.status === 'taken' && (
        <>
          <span className="text-neutral-400">🔴 {result.domain} is taken</span>
          {result.alt?.available && (
            <>
              <span className="text-emerald-300">— {result.alt.domain} is available{result.alt.premium ? ' (premium)' : ''}</span>
              {buyButton(result.alt.domain, result.alt.priceUsd, result.alt.premium, result.purchase)}
            </>
          )}
        </>
      )}
      {result.status === 'unknown' && (
        <span className="text-neutral-500" title={result.error}>
          Apex availability unknown{result.error === 'missing_vercel_token' ? ' (set VERCEL_TOKEN)' : ''}
        </span>
      )}
      {showCockpitLink && result.status !== 'unknown' && (
        <Link href="/admin/restaurant-domains" className="text-sky-400 underline underline-offset-2 hover:text-sky-300">
          Location domains →
        </Link>
      )}
      {error && <span className="text-[11px] text-red-400">{error}</span>}
    </span>
  );
}
