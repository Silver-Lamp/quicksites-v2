'use client';

// components/admin/prospects-client.tsx
//
// Interactive surface for the "businesses near me" fan-out. Discover (sweep a city →
// prospects, no AI), review by lead tier, selectively Build draft sites (AI), Dismiss,
// and launch location-industry domain campaigns from the competition cards.

import { Fragment, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import type { Prospect } from '@/lib/outreach/prospects';
import type { GeoCampaign } from '@/lib/outreach/geoCampaigns';
import { normalizeGscDomain } from '@/lib/gsc/normalizeDomain';
import { effectivePriceCents, formatCents } from '@/lib/outreach/geoPricing';
import { nextActionLabel } from '@/components/admin/templates/campaign-badge';

type GscStat = { clicks: number; impressions: number; position: number };

/** Rank badge from GSC average position (0/no impressions = not yet indexed). */
function rankBadge(g: GscStat | undefined) {
  if (!g || (!g.impressions && !g.position)) {
    return { label: 'Not ranked', cls: 'bg-neutral-800 text-neutral-500' };
  }
  const p = g.position;
  if (p > 0 && p <= 10) return { label: `Page 1 · #${p}`, cls: 'bg-emerald-500/20 text-emerald-300' };
  if (p > 0 && p <= 20) return { label: `Page 2 · #${p}`, cls: 'bg-amber-500/20 text-amber-300' };
  return { label: g.impressions ? `Ranking · #${p}` : 'Indexed', cls: 'bg-sky-500/15 text-sky-300' };
}

// Leaflet is client-only — load the sweep map without SSR.
const ProspectsMap = dynamic(() => import('@/components/admin/prospects-map'), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-xs text-neutral-500">Loading map…</div>,
});

// Curated categories → Google Places (New) `includedTypes`. Kept to well-known valid
// place types so a sweep never 400s on an unknown type.
const CATEGORIES: { label: string; types: string[] }[] = [
  { label: 'Restaurants', types: ['restaurant', 'cafe', 'bar'] },
  { label: 'Plumbing', types: ['plumber'] },
  { label: 'Electrical', types: ['electrician'] },
  { label: 'Painting', types: ['painter'] },
  { label: 'Roofing', types: ['roofing_contractor'] },
  { label: 'Contractor', types: ['general_contractor'] },
  { label: 'Moving', types: ['moving_company'] },
  { label: 'Auto repair', types: ['car_repair'] },
  { label: 'Dental', types: ['dentist'] },
  { label: 'Salon / Spa', types: ['hair_care', 'beauty_salon', 'nail_salon', 'spa'] },
  { label: 'Fitness', types: ['gym'] },
  { label: 'Real estate', types: ['real_estate_agency'] },
  { label: 'Legal', types: ['lawyer'] },
];

const TIER_META: Record<string, { label: string; cls: string }> = {
  no_website: { label: 'No website', cls: 'bg-emerald-500/20 text-emerald-300' },
  dated: { label: 'Dated site', cls: 'bg-amber-500/20 text-amber-300' },
  has_site: { label: 'Has a site', cls: 'bg-neutral-800 text-neutral-400' },
};

function prettyIndustry(key: string | null): string {
  if (!key) return 'Business';
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function ProspectsClient({
  initialProspects,
  initialCampaigns,
  channels = { mail: false, sms: false, call: false },
  callCounts = {},
}: {
  initialProspects: Prospect[];
  initialCampaigns: GeoCampaign[];
  /** Which paid outreach channels are enabled server-side (env-gated). */
  channels?: { mail: boolean; sms: boolean; call: boolean };
  /** Tracked-call count per geo-campaign id. */
  callCounts?: Record<string, number>;
}) {
  const router = useRouter();
  const [city, setCity] = useState('');
  const [region, setRegion] = useState('');
  const [radiusKm, setRadiusKm] = useState(3);
  const [picked, setPicked] = useState<Set<string>>(new Set(['Restaurants']));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  // Per-campaign inline result for the Mail/Text actions (so feedback shows on the
  // row, not just a banner at the top of the page that scrolls out of view).
  const [rowMsg, setRowMsg] = useState<Record<string, { ok: boolean; text: string }>>({});
  // GSC rank/traffic per domain (28-day), best-effort + lazy — proves "which have we ranked".
  const [gscByDomain, setGscByDomain] = useState<Record<string, GscStat> | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    fetch('/api/gsc/summary')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (alive && j?.ok && j.byDomain) setGscByDomain(j.byDomain); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const prospects = initialProspects;

  const toggleCat = (label: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });

  const toggleSel = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  async function post(url: string, body: unknown): Promise<any> {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || `Request failed (${res.status}).`);
    return json;
  }

  async function discover() {
    setMsg(null);
    if (!city.trim()) return setMsg('Enter a city to sweep.');
    const includedTypes = [...picked].flatMap((l) => CATEGORIES.find((c) => c.label === l)?.types ?? []);
    if (!includedTypes.length) return setMsg('Pick at least one category.');
    setBusy('discover');
    try {
      const r = await post('/api/admin/prospects/discover', {
        city: city.trim(),
        region: region.trim(),
        radiusMeters: Math.round(radiusKm * 1000),
        includedTypes,
      });
      setMsg(
        `Swept ${r.found} businesses — ${r.tallies.no_website} no website, ${r.tallies.dated} dated, ${r.tallies.has_site} with a site. (${r.inserted} new)`,
      );
      router.refresh();
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(null);
    }
  }

  async function buildSelected() {
    const ids = [...selected];
    if (!ids.length) return setMsg('Select prospects to build.');
    setBusy('build');
    setMsg(null);
    try {
      const r = await post('/api/admin/prospects/build', { prospectIds: ids.slice(0, 10) });
      setMsg(`Built ${r.built} draft site(s). They're now in the Outreach pipeline.`);
      setSelected(new Set());
      router.refresh();
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(null);
    }
  }

  async function dismiss(id: string) {
    setBusy(id);
    try {
      await post('/api/admin/prospects/dismiss', { id });
      router.refresh();
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(null);
    }
  }

  const campaignCount = (campaignId: string) =>
    prospects.filter((p) => p.geo_campaign_id === campaignId).length;

  async function mailPostcards(c: GeoCampaign) {
    if (!channels.mail) return;
    const n = campaignCount(c.id);
    if (!window.confirm(`Mail postcards for ${c.domain} to ${n} competing business${n === 1 ? '' : 'es'}?\n\nThis sends real physical mail (Lob) and may incur cost.`)) return;
    setBusy(`mail:${c.id}`);
    setRowMsg((m) => { const { [c.id]: _drop, ...rest } = m; return rest; });
    try {
      const r = await post('/api/admin/prospects/mail-postcards', { campaignId: c.id });
      setRowMsg((m) => ({ ...m, [c.id]: { ok: true, text: `Mailed ${r.mailed} postcard(s)` } }));
      router.refresh();
    } catch (e: any) {
      setRowMsg((m) => ({ ...m, [c.id]: { ok: false, text: e.message } }));
    } finally {
      setBusy(null);
    }
  }

  async function textProspects(c: GeoCampaign) {
    if (!channels.sms) return;
    const n = campaignCount(c.id);
    if (!window.confirm(`Text the claim link for ${c.domain} to ${n} competing business${n === 1 ? '' : 'es'}?\n\nThis sends real SMS (Twilio) and may incur cost.`)) return;
    setBusy(`sms:${c.id}`);
    setRowMsg((m) => { const { [c.id]: _drop, ...rest } = m; return rest; });
    try {
      const r = await post('/api/admin/prospects/text-prospects', { campaignId: c.id });
      setRowMsg((m) => ({ ...m, [c.id]: { ok: true, text: `Sent ${r.sent} text(s)` } }));
      router.refresh();
    } catch (e: any) {
      setRowMsg((m) => ({ ...m, [c.id]: { ok: false, text: e.message } }));
    } finally {
      setBusy(null);
    }
  }

  async function provisionNumber(c: GeoCampaign) {
    if (!channels.call) return;
    const forwardTo = window.prompt(
      `Buy a tracking number for ${c.domain} and forward calls to which phone?\n\nThis provisions a real Twilio number (~$1/mo). Leave blank to use the platform fallback.`,
      '',
    );
    if (forwardTo === null) return; // cancelled
    setBusy(`call:${c.id}`);
    setRowMsg((m) => { const { [c.id]: _drop, ...rest } = m; return rest; });
    try {
      const r = await post('/api/admin/prospects/geo-campaign/provision-number', {
        campaignId: c.id,
        forwardTo: forwardTo.trim() || undefined,
      });
      setRowMsg((m) => ({ ...m, [c.id]: { ok: true, text: `Tracking number: ${r.number}` } }));
      router.refresh();
    } catch (e: any) {
      setRowMsg((m) => ({ ...m, [c.id]: { ok: false, text: e.message } }));
    } finally {
      setBusy(null);
    }
  }

  async function setPrice(c: GeoCampaign) {
    setBusy(`price:${c.id}`);
    setRowMsg((m) => { const { [c.id]: _drop, ...rest } = m; return rest; });
    try {
      const r = await post('/api/admin/prospects/geo-campaign/set-pricing', { campaignId: c.id });
      setRowMsg((m) => ({ ...m, [c.id]: { ok: true, text: `Plan set: ${formatCents(r.pricing.locked_rate_cents)} → ${formatCents(r.pricing.price_cents)}/mo` } }));
      router.refresh();
    } catch (e: any) {
      setRowMsg((m) => ({ ...m, [c.id]: { ok: false, text: e.message } }));
    } finally {
      setBusy(null);
    }
  }

  async function rent(c: GeoCampaign) {
    const email = window.prompt(`Create a rental checkout link for ${c.domain}.\n\nRenter email (optional):`, c.renter_email || '');
    if (email === null) return; // cancelled
    setBusy(`rent:${c.id}`);
    setRowMsg((m) => { const { [c.id]: _drop, ...rest } = m; return rest; });
    try {
      const r = await post('/api/admin/prospects/geo-campaign/rent', { campaignId: c.id, renterEmail: email.trim() || undefined });
      if (r.url) window.open(r.url, '_blank', 'noopener,noreferrer');
      setRowMsg((m) => ({ ...m, [c.id]: { ok: true, text: 'Checkout link opened — send it to the renter' } }));
      router.refresh();
    } catch (e: any) {
      setRowMsg((m) => ({ ...m, [c.id]: { ok: false, text: e.message } }));
    } finally {
      setBusy(null);
    }
  }

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  async function setWinner(c: GeoCampaign, prospectId: string | null) {
    setBusy(`winner:${prospectId ?? c.id}`);
    try {
      await post('/api/admin/prospects/geo-campaign/set-winner', { campaignId: c.id, prospectId });
      router.refresh();
    } catch (e: any) {
      setRowMsg((m) => ({ ...m, [c.id]: { ok: false, text: e.message } }));
    } finally {
      setBusy(null);
    }
  }

  async function passProspect(p: Prospect, undo = false) {
    setBusy(`pass:${p.id}`);
    try {
      await post('/api/admin/prospects/pass', { id: p.id, undo });
      router.refresh();
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(null);
    }
  }

  async function launchGeo(group: CompetitionGroup) {
    setBusy(`geo:${group.key}`);
    setMsg(null);
    try {
      const r = await post('/api/admin/prospects/geo-campaign', {
        city: group.city,
        region: group.region,
        industryKey: group.industryKey,
        prospectIds: group.prospects.map((p) => p.id),
      });
      setMsg(`Campaign launched: ${r.domain} (${r.domainStatus}) — pitch site ready, ${r.pitchedProspects} businesses tagged.`);
      router.refresh();
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(null);
    }
  }

  // Group no-website prospects by city + industry → competition cards.
  const competition = useMemo(() => buildCompetitionGroups(prospects), [prospects]);

  // Businesses linked to each launched campaign (the contest roster / waitlist).
  const rosterByCampaign = useMemo(() => {
    const m: Record<string, Prospect[]> = {};
    for (const p of prospects) {
      if (!p.geo_campaign_id || p.status === 'dismissed') continue;
      (m[p.geo_campaign_id] ??= []).push(p);
    }
    return m;
  }, [prospects]);

  const byTier = useMemo(() => {
    const g: Record<string, Prospect[]> = { no_website: [], dated: [], has_site: [] };
    for (const p of prospects) (g[p.lead_tier] ?? g.has_site).push(p);
    return g;
  }, [prospects]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 text-white">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Businesses near me</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Sweep a city for businesses with no website (or a dated one), build claimable sites, and grab the
            exact-match geo domains.
          </p>
        </div>
        <a href="/admin/outreach" className="text-sm text-amber-300 underline underline-offset-4 hover:text-amber-200">
          Outreach pipeline →
        </a>
      </div>

      {/* Discover panel */}
      <div className="mt-6 rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col text-xs text-neutral-400">
            City
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Boston"
              className="mt-1 w-44 rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="flex flex-col text-xs text-neutral-400">
            State
            <input
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="MA"
              className="mt-1 w-24 rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="flex flex-col text-xs text-neutral-400">
            Radius: {radiusKm} km
            <input
              type="range"
              min={1}
              max={25}
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
              className="mt-3 w-40"
            />
          </label>
          <button
            onClick={discover}
            disabled={busy === 'discover'}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {busy === 'discover' ? 'Sweeping…' : 'Discover'}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.label}
              onClick={() => toggleCat(c.label)}
              className={`rounded-full px-3 py-1 text-xs ${
                picked.has(c.label)
                  ? 'bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/40'
                  : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {msg && <div className="mt-4 rounded-lg border border-neutral-800 bg-neutral-900/60 px-4 py-2 text-sm text-neutral-200">{msg}</div>}

      {/* Map of swept prospects — click a marker to select it for building. */}
      {prospects.some((p) => p.address_lat != null && p.address_lon != null) && (
        <div className="mt-6">
          <div className="h-[420px] overflow-hidden rounded-xl border border-neutral-800">
            <ProspectsMap prospects={prospects} selected={selected} onToggle={toggleSel} />
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-xs text-neutral-400">
            <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full bg-emerald-400" /> No website</span>
            <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full bg-amber-400" /> Dated site</span>
            <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full bg-neutral-500" /> Has a site</span>
            <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full bg-indigo-400" /> Selected</span>
          </div>
        </div>
      )}

      {/* Competition cards → geo-domain campaigns */}
      {competition.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Competition cards — grab the domain</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {competition.map((g) => (
              <div key={g.key} className="rounded-xl border border-emerald-900/60 bg-emerald-950/20 p-4">
                <div className="text-sm font-semibold text-white">
                  {g.city} · {prettyIndustry(g.industryKey)}
                </div>
                <div className="mt-1 text-xs text-neutral-400">{g.prospects.length} businesses with no website</div>
                <ul className="mt-2 space-y-0.5 text-xs text-neutral-300">
                  {g.prospects.slice(0, 4).map((p) => (
                    <li key={p.id} className="truncate">• {p.business_name}</li>
                  ))}
                  {g.prospects.length > 4 && <li className="text-neutral-500">+{g.prospects.length - 4} more</li>}
                </ul>
                <button
                  onClick={() => launchGeo(g)}
                  disabled={busy === `geo:${g.key}`}
                  className="mt-3 w-full rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {busy === `geo:${g.key}` ? 'Launching…' : 'Launch geo-domain campaign'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Existing campaigns */}
      {initialCampaigns.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Geo-domain campaigns</h2>
          <div className="mt-3 overflow-x-auto rounded-xl border border-neutral-800">
            <table className="min-w-full text-sm">
              <thead className="bg-neutral-900">
                <tr className="text-left [&>th]:px-4 [&>th]:py-2 [&>th]:font-medium [&>th]:text-neutral-400">
                  <th>Domain</th><th>City</th><th>Industry</th><th>Domain status</th><th>Status</th><th>Ranking</th><th>Calls</th><th>Plan</th><th>Outreach</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {initialCampaigns.map((c) => {
                  const roster = rosterByCampaign[c.id] ?? [];
                  const isOpen = expanded.has(c.id);
                  const recs =
                    c.recommendations && (c.recommendations.nextAction || (Array.isArray(c.recommendations.ranking) && c.recommendations.ranking.length))
                      ? c.recommendations
                      : null;
                  const nextCount = recs ? (recs.ranking?.length ?? 0) + (recs.nextAction ? 1 : 0) : 0;
                  const expandable = roster.length > 0 || !!recs;
                  const tierRank: Record<string, number> = { no_website: 0, dated: 1, has_site: 2 };
                  const sortedRoster = roster.slice().sort((a, b) => {
                    const aw = c.claimed_by_prospect_id === a.id ? 0 : 1;
                    const bw = c.claimed_by_prospect_id === b.id ? 0 : 1;
                    if (aw !== bw) return aw - bw;
                    const ap = a.waitlist_status === 'passed' ? 1 : 0;
                    const bp = b.waitlist_status === 'passed' ? 1 : 0;
                    if (ap !== bp) return ap - bp;
                    return (tierRank[a.lead_tier] ?? 3) - (tierRank[b.lead_tier] ?? 3);
                  });
                  return (
                  <Fragment key={c.id}>
                  <tr className="[&>td]:px-4 [&>td]:py-2">
                    <td className="font-mono text-xs text-sky-300">
                      {expandable && (
                        <button onClick={() => toggleExpand(c.id)} className="mr-1 text-neutral-400 hover:text-white" title="Show next steps + the competition waitlist">
                          {isOpen ? '▾' : '▸'}
                        </button>
                      )}
                      {c.domain}
                      {nextCount > 0 && (
                        <span className="ml-1 rounded-full bg-fuchsia-500/20 px-1.5 py-0.5 text-[10px] font-medium text-fuchsia-200">{nextCount} next</span>
                      )}
                    </td>
                    <td>{c.city}</td>
                    <td>{prettyIndustry(c.industry_key)}</td>
                    <td className="text-xs text-neutral-400">{c.domain_status}</td>
                    <td className="text-xs text-neutral-400">{c.status}</td>
                    <td className="text-xs">
                      {(() => {
                        const g = gscByDomain?.[normalizeGscDomain(c.domain)];
                        const b = rankBadge(g);
                        return (
                          <div className="flex flex-col gap-0.5">
                            <span className={`inline-block w-fit rounded px-1.5 py-0.5 ${b.cls}`}>{b.label}</span>
                            {g && (g.clicks || g.impressions) ? (
                              <span className="text-neutral-500">{g.clicks} clk · {g.impressions} impr</span>
                            ) : null}
                            {c.rank_trend?.positionDelta ? (
                              <span
                                className={c.rank_trend.direction === 'up' ? 'text-emerald-400' : c.rank_trend.direction === 'down' ? 'text-red-400' : 'text-neutral-500'}
                                title="Change in position since the last sync"
                              >
                                {c.rank_trend.direction === 'up' ? '▲' : c.rank_trend.direction === 'down' ? '▼' : '→'} {Math.abs(c.rank_trend.positionDelta).toFixed(0)} spot{Math.abs(c.rank_trend.positionDelta) === 1 ? '' : 's'}
                              </span>
                            ) : null}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="text-xs">
                      {c.tracking_number ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="font-mono text-sky-300">{c.tracking_number}</span>
                          <span className="text-neutral-500">{callCounts[c.id] ?? 0} call{(callCounts[c.id] ?? 0) === 1 ? '' : 's'}</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => provisionNumber(c)}
                          disabled={!channels.call || busy === `call:${c.id}`}
                          title={channels.call ? 'Buy a tracking number that forwards to the business' : 'Call tracking is off — set CALL_TRACKING_ENABLED=1 (+ Twilio creds)'}
                          className={channels.call ? 'text-sky-400 hover:text-sky-300' : 'cursor-not-allowed text-neutral-600'}
                        >
                          {busy === `call:${c.id}` ? '…' : 'Get number'}
                        </button>
                      )}
                    </td>
                    <td className="text-xs">
                      {c.pricing_model === 'flat' ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-neutral-200">{formatCents(effectivePriceCents(c))}/mo</span>
                          {c.rank_status !== 'page1' && c.price_cents && c.locked_rate_cents && c.price_cents !== c.locked_rate_cents ? (
                            <span className="text-amber-400/80">founder → {formatCents(c.price_cents)} on page 1</span>
                          ) : null}
                          {c.subscription_status === 'active' ? (
                            <span className="text-emerald-400">Rented</span>
                          ) : (
                            <button onClick={() => rent(c)} disabled={busy === `rent:${c.id}`} className="w-fit text-sky-400 hover:text-sky-300">
                              {busy === `rent:${c.id}` ? '…' : 'Create rental link'}
                            </button>
                          )}
                        </div>
                      ) : (
                        <button onClick={() => setPrice(c)} disabled={busy === `price:${c.id}`} className="text-sky-400 hover:text-sky-300">
                          {busy === `price:${c.id}` ? '…' : 'Set price'}
                        </button>
                      )}
                    </td>
                    <td className="text-right">
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex justify-end gap-3 text-xs">
                          <a href={`/admin/prospects/poster/${c.id}`} target="_blank" rel="noopener noreferrer" className="text-emerald-400 underline">Poster</a>
                          <button
                            onClick={() => mailPostcards(c)}
                            disabled={!channels.mail || busy === `mail:${c.id}`}
                            title={channels.mail ? 'Mail the poster to each competing business' : 'Postcard mail is off — set LOB_API_KEY + LOB_FROM_* + POSTCARD_MAIL_ENABLED=1'}
                            className={channels.mail ? 'text-amber-400 hover:text-amber-300' : 'cursor-not-allowed text-neutral-600'}
                          >
                            {busy === `mail:${c.id}` ? '…' : 'Mail'}
                          </button>
                          <button
                            onClick={() => textProspects(c)}
                            disabled={!channels.sms || busy === `sms:${c.id}`}
                            title={channels.sms ? 'Text the claim link to each business' : 'SMS is off — set PROSPECT_SMS_ENABLED=1 (requires A2P 10DLC)'}
                            className={channels.sms ? 'text-sky-400 hover:text-sky-300' : 'cursor-not-allowed text-neutral-600'}
                          >
                            {busy === `sms:${c.id}` ? '…' : 'Text'}
                          </button>
                          {c.template_id && (
                            <a href={`/admin/templates/${c.template_id}`} className="text-neutral-400 underline">Edit</a>
                          )}
                        </div>
                        {rowMsg[c.id] && (
                          <div className={rowMsg[c.id].ok ? 'text-xs text-emerald-400' : 'text-xs text-red-400'}>
                            {rowMsg[c.id].text}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                  {isOpen && expandable && (
                    <tr className="bg-neutral-950/60">
                      <td colSpan={9} className="px-4 py-3">
                        {recs && (
                          <div className="mb-4">
                            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Next steps</div>
                            {Array.isArray(recs.summary?.steps) && recs.summary.steps.length > 0 && (
                              <div className="mb-3 rounded-lg border border-fuchsia-500/20 bg-fuchsia-500/[0.06] p-2">
                                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-fuchsia-300/80">Suggested plan ✨</div>
                                <ol className="list-decimal space-y-1 pl-5 text-sm">
                                  {recs.summary.steps.map((s: any, idx: number) => (
                                    <li key={idx}>
                                      <span className="font-medium">{s.title}</span>
                                      {s.why ? <span className="text-neutral-500"> — {s.why}</span> : null}
                                    </li>
                                  ))}
                                </ol>
                              </div>
                            )}
                            {recs.nextAction && (
                              <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                                <span className="rounded bg-fuchsia-500/20 px-2 py-0.5 text-xs text-fuchsia-200">Work the lead</span>
                                <span className="font-medium">{nextActionLabel(recs.nextAction.action)}</span>
                                <span className="text-neutral-500">— {recs.nextAction.reason}</span>
                              </div>
                            )}
                            {Array.isArray(recs.ranking) && recs.ranking.length > 0 && (
                              <ul className="space-y-1">
                                {recs.ranking.slice(0, 5).map((r: any) => (
                                  <li key={r.id} className="flex items-start gap-2 text-sm">
                                    <span className="mt-0.5 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] uppercase text-emerald-300">{r.category}</span>
                                    <span>
                                      <span className="font-medium">{r.title}</span> <span className="text-neutral-500">— {r.detail}</span>
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}
                        {roster.length > 0 && (
                        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                          Competition waitlist — one exclusive slot; the rest are churn backfill
                        </div>
                        )}
                        <ul className="space-y-1">
                          {sortedRoster.map((p) => {
                            const isWinner = c.claimed_by_prospect_id === p.id;
                            const passed = p.waitlist_status === 'passed';
                            return (
                              <li key={p.id} className="flex items-center gap-3 text-sm">
                                <span className={`inline-block w-fit rounded px-1.5 py-0.5 text-xs ${TIER_META[p.lead_tier].cls}`}>{TIER_META[p.lead_tier].label}</span>
                                <span className={`min-w-0 flex-1 truncate ${passed ? 'text-neutral-600 line-through' : ''}`}>
                                  {isWinner && <span className="mr-1 text-amber-300" title="Winner">★</span>}
                                  {p.business_name}
                                </span>
                                {isWinner ? (
                                  <button onClick={() => setWinner(c, null)} disabled={busy === `winner:${c.id}`} className="text-xs text-amber-300 hover:text-amber-200">Winner ✓ — clear</button>
                                ) : (
                                  <>
                                    <button onClick={() => setWinner(c, p.id)} disabled={busy === `winner:${p.id}`} className="text-xs text-emerald-400 hover:text-emerald-300">Make winner</button>
                                    {passed ? (
                                      <button onClick={() => passProspect(p, true)} disabled={busy === `pass:${p.id}`} className="text-xs text-neutral-500 hover:text-white">restore</button>
                                    ) : (
                                      <button onClick={() => passProspect(p, false)} disabled={busy === `pass:${p.id}`} className="text-xs text-neutral-500 hover:text-red-400">pass</button>
                                    )}
                                  </>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Prospect list by tier */}
      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Prospects</h2>
        <button
          onClick={buildSelected}
          disabled={!selected.size || busy === 'build'}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-40"
        >
          {busy === 'build' ? 'Building…' : `Build ${selected.size || ''} draft${selected.size === 1 ? '' : 's'}`}
        </button>
      </div>

      {(['no_website', 'dated', 'has_site'] as const).map((tier) =>
        byTier[tier].length ? (
          <div key={tier} className="mt-4">
            <div className="mb-1 text-xs font-medium text-neutral-500">
              {TIER_META[tier].label} · {byTier[tier].length}
            </div>
            <div className="overflow-x-auto rounded-xl border border-neutral-800">
              <table className="min-w-full text-sm">
                <tbody className="divide-y divide-neutral-800">
                  {byTier[tier].map((p) => (
                    <tr key={p.id} className="[&>td]:px-4 [&>td]:py-2.5 align-middle">
                      <td className="w-8">
                        {p.status === 'discovered' && (
                          <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSel(p.id)} />
                        )}
                      </td>
                      <td className="font-medium">
                        {p.business_name}
                        {p.lead_tier === 'dated' && p.freshness_signals?.length ? (
                          <div className="mt-0.5 text-xs font-normal text-amber-400/80">{p.freshness_signals.join(' · ')}</div>
                        ) : null}
                      </td>
                      <td className="max-w-[16rem] truncate text-xs text-neutral-500">{p.address}</td>
                      <td>
                        <span className={`rounded px-2 py-0.5 text-xs ${TIER_META[p.lead_tier].cls}`}>
                          {TIER_META[p.lead_tier].label}
                          {p.lead_tier === 'dated' && p.freshness_score != null ? ` · ${p.freshness_score}` : ''}
                        </span>
                      </td>
                      <td className="text-xs text-neutral-500">{prettyIndustry(p.industry_key)}</td>
                      <td>
                        {p.status === 'draft_built' ? (
                          <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-xs text-indigo-300">Built</span>
                        ) : p.website ? (
                          <a href={p.website} target="_blank" rel="noopener noreferrer" className="text-xs text-sky-400 underline">
                            site ↗
                          </a>
                        ) : (
                          <span className="text-xs text-neutral-600">—</span>
                        )}
                      </td>
                      <td className="text-right">
                        {p.status === 'draft_built' && p.template_id ? (
                          <a href={`/admin/templates/${p.template_id}`} className="text-xs text-sky-400 underline">Edit →</a>
                        ) : (
                          <button onClick={() => dismiss(p.id)} disabled={busy === p.id} className="text-xs text-neutral-500 hover:text-red-400">
                            dismiss
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null,
      )}

      {prospects.length === 0 && (
        <div className="mt-6 rounded-xl border border-dashed border-neutral-800 px-4 py-10 text-center text-sm text-neutral-500">
          No prospects yet — sweep a city above to find businesses without sites.
        </div>
      )}
    </div>
  );
}

type CompetitionGroup = {
  key: string;
  city: string;
  region: string | null;
  industryKey: string;
  prospects: Prospect[];
};

/** Group open no-website prospects by city + industry into competition cards (≥2). */
function buildCompetitionGroups(prospects: Prospect[]): CompetitionGroup[] {
  const map = new Map<string, CompetitionGroup>();
  for (const p of prospects) {
    if (p.lead_tier !== 'no_website' || p.status !== 'discovered') continue;
    if (!p.city || !p.industry_key || p.industry_key === 'other') continue;
    const key = `${p.city.toLowerCase()}::${p.industry_key}`;
    if (!map.has(key)) {
      map.set(key, { key, city: p.city, region: p.region, industryKey: p.industry_key, prospects: [] });
    }
    map.get(key)!.prospects.push(p);
  }
  return [...map.values()].filter((g) => g.prospects.length >= 2).sort((a, b) => b.prospects.length - a.prospects.length);
}
