'use client';

// components/admin/prospects-client.tsx
//
// Interactive surface for the "businesses near me" fan-out. Discover (sweep a city →
// prospects, no AI), review by lead tier, selectively Build draft sites (AI), Dismiss,
// and launch location-industry domain campaigns from the competition cards.

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import type { Prospect } from '@/lib/outreach/prospects';
import type { GeoCampaign } from '@/lib/outreach/geoCampaigns';
import { normalizeGscDomain } from '@/lib/gsc/normalizeDomain';

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
  channels = { mail: false, sms: false },
}: {
  initialProspects: Prospect[];
  initialCampaigns: GeoCampaign[];
  /** Which paid outreach channels are enabled server-side (env-gated). */
  channels?: { mail: boolean; sms: boolean };
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
                  <th>Domain</th><th>City</th><th>Industry</th><th>Domain status</th><th>Status</th><th>Ranking</th><th>Outreach</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {initialCampaigns.map((c) => (
                  <tr key={c.id} className="[&>td]:px-4 [&>td]:py-2">
                    <td className="font-mono text-xs text-sky-300">{c.domain}</td>
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
                          </div>
                        );
                      })()}
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
                ))}
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
