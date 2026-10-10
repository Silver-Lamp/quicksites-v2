'use client';

// components/admin/no-ordering-client.tsx
//
// The operator's workbench for the "site, but no online ordering" segment:
//   1. pick a city (or type one) → Sweep restaurants here (Places: restaurant/cafe/bar) →
//      the sweep already reads each site's ordering platform (lib/prospects/orderingCheck.ts);
//   2. Re-check sites for a city swept before the signal existed;
//   3. the grouped list — call / app-only / site-only / leave alone / not checked — with
//      "Build ordering page" on the first two → the draft is their published menu.
import * as React from 'react';
import type { RestaurantCity } from '@/lib/prospects/noOrderingList';
import { platformLabel, platformFromWebsiteHost } from '@/lib/prospects/orderingSegments';

type Row = {
  id: string;
  business_name: string | null;
  phone: string | null;
  address: string | null;
  website: string | null;
  rating: number | null;
  review_count: number | null;
  ordering_platform: string | null;
  ordering_checked_at: string | null;
  ordering_evidence: string[] | null;
  template_id: string | null;
  status: string | null;
  slug: string | null;
};
type Groups = { call: Row[]; shop: Row[]; thirdParty: Row[]; siteOnly: Row[]; leaveAlone: Row[]; unchecked: Row[] };
type Loaded = { groups: Groups; total: number; checkedOn: string | null };
type Built = { editorUrl: string; claimUrl: string; evolveUrl?: string; slug: string; menuSource?: string; menuItems?: number; droppedItems?: number };

const GROUP_META: Array<{ key: keyof Groups; title: string; blurb: string; tone: string; build: boolean }> = [
  { key: 'call', title: 'Call first — a site, no online ordering found', blurb: 'Nobody charges them for orders today. Build the ordering page from their own menu and walk in with it.', tone: 'border-emerald-500/30 bg-emerald-500/[0.05]', build: true },
  { key: 'shop', title: 'A shop on their site, but no food ordering', blurb: 'A WooCommerce or Shopify cart that ships beans, gift cards or merch. They can sell online; they cannot take a drink or food order for pickup. Pitch the ordering page as the thing beside the shop.', tone: 'border-emerald-500/30 bg-emerald-500/[0.05]', build: true },
  { key: 'thirdParty', title: 'App only — DoorDash / Grubhub / Uber Eats', blurb: 'They pay a per-order commission. A single-digit take undercuts it at any volume.', tone: 'border-amber-500/30 bg-amber-500/[0.05]', build: true },
  { key: 'siteOnly', title: 'Ordering page is their only site', blurb: "Google's website for them IS a Toast or Square page. Offer a site that links it — never the ordering.", tone: 'border-sky-500/30 bg-sky-500/[0.04]', build: false },
  { key: 'unchecked', title: 'Not checked yet', blurb: 'Nobody has read these sites. Press Re-check sites.', tone: 'border-zinc-700 bg-zinc-900/40', build: false },
  { key: 'leaveAlone', title: 'Leave alone — on a platform, with their own site', blurb: 'Toast, Square and the like. Nothing to offer today; /compare/toast says when that changes.', tone: 'border-zinc-800 bg-zinc-900/30', build: false },
];

function hostOf(url: string | null): string {
  try {
    return new URL(url ?? '').hostname.replace(/^www\./, '');
  } catch {
    return url ?? '';
  }
}

export default function NoOrderingClient({ cities, initialCity, initialRegion }: { cities: RestaurantCity[]; initialCity: string; initialRegion: string }) {
  const [city, setCity] = React.useState(initialCity);
  const [region, setRegion] = React.useState(initialRegion);
  const [radius, setRadius] = React.useState(3000);
  const [loaded, setLoaded] = React.useState<Loaded | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [note, setNote] = React.useState<string>('');
  const [built, setBuilt] = React.useState<Record<string, Built>>({});
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const load = React.useCallback(async (c = city, r = region) => {
    if (!c.trim()) return;
    const res = await fetch(`/api/admin/prospects/no-ordering?city=${encodeURIComponent(c.trim())}&region=${encodeURIComponent(r.trim())}`);
    const j = await res.json().catch(() => null);
    if (res.ok && j?.ok) setLoaded({ groups: j.groups, total: j.total, checkedOn: j.checkedOn });
    else setNote(`Couldn't load (${j?.error ?? res.status}).`);
  }, [city, region]);

  React.useEffect(() => {
    if (initialCity) void load(initialCity, initialRegion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sweep() {
    if (!city.trim()) return;
    setBusy('sweep');
    setNote('Sweeping Places for restaurants, cafes and bars — reads each site for an ordering link as it goes…');
    try {
      const res = await fetch('/api/admin/prospects/discover', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ city: city.trim(), region: region.trim(), radiusMeters: radius, includedTypes: ['restaurant', 'cafe', 'bar'], textCategories: [] }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNote(`Sweep failed (${j?.error ?? res.status}). A 501 here usually means Places itself answered an error — see CLAUDE.md on billing.`);
        return;
      }
      setNote(`Swept: ${j.found ?? '?'} found, ${j.inserted ?? '?'} new, ${j.orderingChecked ?? 0} sites read. ${radius >= 8000 ? 'A wide circle on a coast or an island pulls in the mainland — check addresses.' : ''}`);
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function recheck() {
    if (!city.trim()) return;
    setBusy('check');
    setNote('Reading each restaurant site for an ordering link…');
    try {
      const res = await fetch('/api/admin/prospects/check-ordering', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ city: city.trim(), region: region.trim() || undefined, limit: 150, recheckAfterDays: 7 }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNote(`Check failed (${j?.error ?? res.status}).`);
        return;
      }
      const by = Object.entries(j.byPlatform ?? {}).map(([k, v]) => `${v} ${platformLabel(k)}`).join(' · ');
      setNote(`Read ${j.checked} of ${j.considered} sites (${j.unreachable} unreachable). ${by}`);
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function build(row: Row) {
    setBusy(row.id);
    setErrors((e) => ({ ...e, [row.id]: '' }));
    try {
      const res = await fetch('/api/admin/prospects/build', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prospectIds: [row.id], mode: 'from_site' }),
      });
      const j = await res.json().catch(() => ({}));
      const r = j?.results?.[0];
      if (!res.ok || !r?.ok) {
        setErrors((e) => ({ ...e, [row.id]: r?.error ?? j?.error ?? `HTTP ${res.status}` }));
        return;
      }
      setBuilt((b) => ({ ...b, [row.id]: { editorUrl: r.editorUrl, claimUrl: r.claimUrl, evolveUrl: r.evolveUrl, slug: r.slug, menuSource: r.menuSource, menuItems: r.summary?.menuItems, droppedItems: r.summary?.droppedItems?.length } }));
    } finally {
      setBusy(null);
    }
  }

  // ── Evolve postcards: count, preview, test-mail, mail ─────────────────────────────────────
  const [cards, setCards] = React.useState<{ mailable: { prospectId: string; businessName: string }[]; blocked: Record<string, number>; lobConfigured: boolean; mailEnabled: boolean; senderReady: boolean } | null>(null);
  const [cardNote, setCardNote] = React.useState('');
  const loadCards = React.useCallback(async (c = city, r = region) => {
    if (!c.trim()) return;
    const res = await fetch(`/api/admin/prospects/mail-evolve-postcards?city=${encodeURIComponent(c.trim())}&region=${encodeURIComponent(r.trim())}`);
    const j = await res.json().catch(() => null);
    if (res.ok && j?.ok) setCards(j);
  }, [city, region]);
  React.useEffect(() => {
    if (loaded) void loadCards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  async function previewCards() {
    setBusy('cards');
    try {
      const res = await fetch('/api/admin/prospects/mail-evolve-postcards', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ city: city.trim(), region: region.trim(), preview: true }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.cards?.length) {
        setCardNote(`Nothing to preview (${j?.error ?? 'no mailable card in this city'}).`);
        return;
      }
      for (const card of j.cards) {
        for (const side of ['frontHtml', 'backHtml'] as const) {
          const blob = new Blob([card[side]], { type: 'text/html' });
          window.open(URL.createObjectURL(blob), '_blank', 'noopener');
        }
      }
      setCardNote(`Opened ${j.cards.length} card${j.cards.length === 1 ? '' : 's'} (front + back). ${j.blocked?.length ? `${j.blocked.length} blocked: ${j.blocked.map((b: any) => `${b.businessName} (${b.reason})`).join(', ')}.` : ''}`);
    } finally {
      setBusy(null);
    }
  }

  async function mailCards(test: boolean) {
    if (!test && !window.confirm(`Mail Evolve postcards to ${cards?.mailable.length ?? 0} restaurants in ${city}? This spends postage.`)) return;
    setBusy('cards');
    setCardNote(test ? 'Mailing one test card to the configured test address…' : 'Mailing…');
    try {
      const res = await fetch('/api/admin/prospects/mail-evolve-postcards', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ city: city.trim(), region: region.trim(), test }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCardNote(`Mail failed (${j?.code ?? j?.error ?? res.status}).`);
        return;
      }
      setCardNote(`${test ? 'Test card' : 'Cards'}: ${j.mailed} mailed, ${j.failed} failed, ${j.blocked} blocked.${j.results?.filter((r: any) => !r.ok).map((r: any) => ` ${r.businessName}: ${r.error ?? r.skipped}`).join('') ?? ''}`);
      await loadCards();
      await load();
    } finally {
      setBusy(null);
    }
  }

  const checkedLabel = loaded?.checkedOn ? new Date(loaded.checkedOn).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : null;

  return (
    <div className="mt-6 space-y-6">
      {/* Pick or type a city */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="block text-xs text-zinc-500">City</span>
            <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Vashon" className="mt-1 w-48 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-white" />
          </label>
          <label className="text-sm">
            <span className="block text-xs text-zinc-500">State</span>
            <input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="WA" className="mt-1 w-20 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-white" />
          </label>
          <label className="text-sm">
            <span className="block text-xs text-zinc-500">Radius (m)</span>
            <input type="number" value={radius} min={500} max={15000} step={500} onChange={(e) => setRadius(Number(e.target.value) || 3000)} className="mt-1 w-24 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-white" />
          </label>
          <button type="button" disabled={busy !== null || !city.trim()} onClick={() => void load()} className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-50">
            Show
          </button>
          <button type="button" disabled={busy !== null || !city.trim()} onClick={sweep} className="rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 disabled:opacity-50">
            {busy === 'sweep' ? 'Sweeping…' : 'Sweep restaurants here'}
          </button>
          <button type="button" disabled={busy !== null || !city.trim()} onClick={recheck} className="rounded-md border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-sm text-sky-200 hover:bg-sky-500/20 disabled:opacity-50">
            {busy === 'check' ? 'Reading sites…' : 'Re-check sites'}
          </button>
        </div>
        {note && <p className="mt-3 text-xs text-zinc-400">{note}</p>}
        {cities.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {cities.slice(0, 24).map((c) => (
              <button
                key={`${c.city}|${c.region}`}
                type="button"
                onClick={() => {
                  setCity(c.city);
                  setRegion(c.region ?? '');
                  void load(c.city, c.region ?? '');
                }}
                className="rounded-full border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-xs text-zinc-300 hover:border-emerald-500/40"
                title={`${c.restaurants} restaurants with a site · ${c.checked} checked · ${c.noOrdering} with no ordering found`}
              >
                {c.city}{c.region ? `, ${c.region}` : ''} <span className="text-zinc-500">· {c.noOrdering}/{c.restaurants}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {loaded && cards && (
        <div className="rounded-xl border border-violet-500/30 bg-violet-500/[0.05] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-white">Evolve postcards</h2>
              <p className="mt-1 text-xs text-zinc-400">
                One card per built restaurant draft WITH a menu: &ldquo;your menu, orderable from a phone, your site stays&rdquo;, a QR to the Evolve page.
                {' '}{cards.mailable.length} ready{Object.keys(cards.blocked).length ? ` · blocked: ${Object.entries(cards.blocked).map(([k, v]) => `${v} ${k.replace(/_/g, ' ')}`).join(', ')}` : ''}.
                {!cards.lobConfigured ? ' Lob is not configured.' : !cards.mailEnabled ? ' Postcard mail is OFF (POSTCARD_MAIL_ENABLED).' : !cards.senderReady ? ' Sender profile needs a name + email.' : ''}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={busy !== null || !cards.mailable.length} onClick={previewCards} className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-50">Preview cards</button>
              <button type="button" disabled={busy !== null || !cards.mailable.length || !cards.lobConfigured || !cards.mailEnabled} onClick={() => mailCards(true)} className="rounded-md border border-violet-500/40 bg-violet-500/10 px-3 py-1.5 text-sm text-violet-200 hover:bg-violet-500/20 disabled:opacity-50">Mail one test card</button>
              <button type="button" disabled={busy !== null || !cards.mailable.length || !cards.lobConfigured || !cards.mailEnabled || !cards.senderReady} onClick={() => mailCards(false)} className="rounded-md bg-violet-500 px-3 py-1.5 text-sm font-semibold text-zinc-950 hover:bg-violet-400 disabled:opacity-50">
                {busy === 'cards' ? 'Working…' : `Mail ${cards.mailable.length} card${cards.mailable.length === 1 ? '' : 's'}`}
              </button>
            </div>
          </div>
          {cardNote && <p className="mt-2 text-xs text-zinc-400">{cardNote}</p>}
        </div>
      )}

      {loaded && (
        <div className="space-y-4">
          <p className="text-xs text-zinc-500">
            {loaded.total} restaurants with a website in {city}{region ? `, ${region}` : ''}.{' '}
            {checkedLabel ? `Sites last read ${checkedLabel}.` : 'No site has been read yet.'} Homepage plus its order/menu links; a link kept elsewhere would be missed.
          </p>
          {GROUP_META.map((g) => {
            const rows = loaded.groups[g.key];
            return (
              <section key={g.key} className={`rounded-xl border p-4 ${g.tone}`}>
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-sm font-semibold text-white">{g.title}</h2>
                  <span className="text-xs text-zinc-400">{rows.length}</span>
                </div>
                <p className="mt-1 text-xs text-zinc-400">{g.blurb}</p>
                {rows.length > 0 && (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-[720px] text-left text-sm">
                      <thead className="text-xs uppercase tracking-wide text-zinc-500">
                        <tr>
                          <th className="py-1 pr-3">Restaurant</th>
                          <th className="py-1 pr-3">Site</th>
                          <th className="py-1 pr-3">Ordering</th>
                          <th className="py-1 pr-3 text-right">Google</th>
                          <th className="py-1 pr-3">Draft</th>
                          {g.build && <th className="py-1 text-right">Build</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r) => {
                          const b = built[r.id];
                          const err = errors[r.id];
                          const label = g.key === 'siteOnly' || g.key === 'thirdParty' ? platformLabel(platformFromWebsiteHost(r.website) ?? r.ordering_platform) : g.key === 'unchecked' ? 'not checked' : platformLabel(r.ordering_platform);
                          return (
                            <React.Fragment key={r.id}>
                              <tr className="border-t border-zinc-800/60">
                                <td className="py-1.5 pr-3 text-zinc-100">
                                  {r.business_name}
                                  {r.phone && <span className="ml-2 text-xs text-zinc-500">{r.phone}</span>}
                                </td>
                                <td className="py-1.5 pr-3">
                                  <a href={r.website ?? '#'} target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:underline">{hostOf(r.website)}</a>
                                </td>
                                <td className="py-1.5 pr-3 text-zinc-300" title={(r.ordering_evidence ?? []).join(', ')}>{label}</td>
                                <td className="py-1.5 pr-3 text-right text-zinc-400">{typeof r.rating === 'number' && r.rating > 0 ? `${r.rating}★ · ${r.review_count ?? 0}` : '—'}</td>
                                <td className="py-1.5 pr-3 text-xs">
                                  {b ? (
                                    <span className="space-x-2">
                                      <a href={b.editorUrl} className="text-emerald-300 hover:underline">open draft →</a>
                                      <a href={`/evolve/${r.id}`} target="_blank" rel="noopener noreferrer" className="text-sky-300 hover:underline">Evolve page →</a>
                                    </span>
                                  ) : r.template_id ? (
                                    <span className="space-x-2">
                                      <a href={`/admin/templates/${r.template_id}`} className="text-sky-300 hover:underline">{r.status === 'claimed' ? 'claimed' : 'built'} →</a>
                                      <a href={`/evolve/${r.id}`} target="_blank" rel="noopener noreferrer" className="text-emerald-300 hover:underline">Evolve page →</a>
                                      <a href={`/api/admin/prospects/evolve-postcard/${r.id}?side=front`} target="_blank" rel="noopener noreferrer" className="text-violet-300 hover:underline">card ↗</a>
                                    </span>
                                  ) : (
                                    <span className="text-zinc-600">—</span>
                                  )}
                                </td>
                                {g.build && (
                                  <td className="py-1.5 text-right">
                                    {!b && !r.template_id && (
                                      <button type="button" disabled={busy !== null} onClick={() => build(r)} className="rounded-md bg-emerald-500 px-2.5 py-1 text-xs font-semibold text-zinc-950 hover:bg-emerald-400 disabled:opacity-50">
                                        {busy === r.id ? 'Reading menu…' : 'Build ordering page'}
                                      </button>
                                    )}
                                  </td>
                                )}
                              </tr>
                              {(b || err) && (
                                <tr>
                                  <td colSpan={g.build ? 6 : 5} className="pb-2 text-xs">
                                    {err ? (
                                      <span className="text-rose-300">{err}</span>
                                    ) : b ? (
                                      <span className="text-zinc-400">
                                        {b.menuSource === 'site' ? `Menu read from their site — ${b.menuItems ?? '?'} items${b.droppedItems ? `, ${b.droppedItems} the site didn't confirm left out` : ''}.` : 'No readable menu on their site — the draft has none.'}{' '}
                                        <a href={b.claimUrl} className="text-zinc-200 underline">claim link</a>
                                      </span>
                                    ) : null}
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
