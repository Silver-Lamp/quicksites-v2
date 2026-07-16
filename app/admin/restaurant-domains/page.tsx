'use client';

// app/admin/restaurant-domains/page.tsx — "Restaurant Location Domains".
// One screen per restaurant apex (<city>-restaurant.com): the domain we own (or could
// buy), the contest running on it, the cohort competing, and the no-website restaurants
// in the area still available to pull into the claim-contest funnel. Actions: add a
// built restaurant to an existing contest, create a contest from ≥2 built candidates,
// copy each restaurant's funnel (claim) link. Data: /api/admin/restaurant-domains.
import * as React from 'react';
import Link from 'next/link';
import NextStepButton from '@/components/admin/templates/next-step-button';

type SeoInfo = { pct: number; done: number; total: number; hardLeft: number; nextStep?: any | null };

type AreaRestaurant = {
  id: string;
  business_name: string;
  phone: string | null;
  address: string | null;
  status: string;
  template_id: string | null;
  template_slug: string | null;
  published: boolean;
  site_url: string | null;
  claim_url: string | null;
  seo: SeoInfo | null;
  is_winner: boolean;
  waitlist_status: string | null;
};

type Area = {
  key: string;
  domain: string;
  domain_owned: boolean;
  domain_status: string | null;
  directory_url: string | null;
  city: string;
  region: string | null;
  campaign_id: string | null;
  campaign_status: string | null;
  campaign_kind: string | null;
  apex_template_id: string | null;
  has_winner: boolean;
  winner_name: string | null;
  competitors: AreaRestaurant[];
  candidates: AreaRestaurant[];
};

type ApexSuggestion = {
  area_key: string;
  city: string;
  region: string | null;
  domain: string;
  domain_owned: boolean;
  candidates: number;
  built: number;
  reviews: number;
  score: number;
  rationale: string;
};

type Overview = {
  areas: Area[];
  suggestions: ApexSuggestion[];
  totals: {
    domains_owned: number;
    contests: number;
    contests_decided: number;
    restaurants_competing: number;
    restaurants_available: number;
  };
};

function Kpi({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
      <div className={`text-2xl font-bold tabular-nums ${accent ?? 'text-white'}`}>{value}</div>
      <div className="mt-1 text-xs text-neutral-400">{label}</div>
    </div>
  );
}

function Badge({ tone, children }: { tone: 'emerald' | 'amber' | 'sky' | 'neutral' | 'purple'; children: React.ReactNode }) {
  const tones = {
    emerald: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
    amber: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
    sky: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
    purple: 'border-purple-500/40 bg-purple-500/10 text-purple-300',
    neutral: 'border-neutral-700 bg-neutral-800/60 text-neutral-300',
  } as const;
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

function CopyLink({ url, label = 'Copy claim link' }: { url: string; label?: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {}
      }}
      className="rounded border border-neutral-700 px-2 py-0.5 text-[11px] text-neutral-300 hover:border-neutral-500 hover:text-white"
      title={url}
    >
      {copied ? 'Copied ✓' : label}
    </button>
  );
}

/** Compact SEO meter — same color rules + hover detail as the templates list. */
function SeoMeter({ seo }: { seo: SeoInfo }) {
  const color = seo.pct >= 80 ? 'bg-emerald-500' : seo.pct >= 50 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <span
      className="inline-flex items-center gap-1.5"
      title={`SEO readiness — ${seo.done}/${seo.total} checks${seo.hardLeft ? ` · ${seo.hardLeft} required left` : ''}`}
    >
      <span className="inline-block h-1.5 w-12 overflow-hidden rounded-full bg-neutral-800 align-middle">
        <span className={`block h-full rounded-full ${color}`} style={{ width: `${seo.pct}%` }} />
      </span>
      <span className="text-[11px] font-medium text-neutral-400">{seo.pct}%</span>
    </span>
  );
}

function RestaurantRow({
  r,
  inContest,
  onRefreshUx,
  refreshBusy,
}: {
  r: AreaRestaurant;
  inContest: boolean;
  onRefreshUx?: (r: AreaRestaurant) => void;
  refreshBusy?: boolean;
}) {
  return (
    <tr className="border-b border-neutral-800/60 last:border-0">
      <td className="py-1.5 pr-3">
        <span className="text-neutral-100">{r.business_name}</span>
        {r.is_winner && <span className="ml-2">🏆</span>}
      </td>
      <td className="py-1.5 pr-3 text-neutral-500">{r.phone || '—'}</td>
      <td className="py-1.5 pr-3">
        {r.is_winner ? (
          <Badge tone="emerald">winner</Badge>
        ) : r.waitlist_status === 'passed' ? (
          <Badge tone="neutral">passed</Badge>
        ) : r.status === 'claimed' ? (
          <Badge tone="emerald">claimed</Badge>
        ) : r.template_id ? (
          <Badge tone="sky">{r.published ? 'site live' : 'draft built'}</Badge>
        ) : (
          <Badge tone="amber">no site yet</Badge>
        )}
      </td>
      {/* SEO readiness + the one-click next step — same decorators as the templates list. */}
      <td className="py-1.5 pr-3">
        {r.template_id && r.seo && r.seo.total > 0 && (
          <span className="inline-flex items-center gap-2">
            <SeoMeter seo={r.seo} />
            <NextStepButton
              nextStep={r.seo.nextStep ?? null}
              slug={r.template_slug}
              templateId={r.template_id}
              variant="table"
            />
          </span>
        )}
      </td>
      <td className="py-1.5 text-right">
        <span className="inline-flex items-center gap-1.5">
          {r.template_id && (
            <Link
              href={`/admin/templates/${r.template_id}`}
              className="rounded border border-neutral-700 px-2 py-0.5 text-[11px] text-neutral-200 hover:border-neutral-500"
              title="Open this draft in the editor"
            >
              Edit
            </Link>
          )}
          {r.template_id && !r.published && r.status !== 'claimed' && onRefreshUx && (
            <button
              type="button"
              disabled={refreshBusy}
              onClick={() => onRefreshUx(r)}
              className="rounded border border-fuchsia-500/40 bg-fuchsia-500/10 px-2 py-0.5 text-[11px] text-fuchsia-200 hover:bg-fuchsia-500/20 disabled:opacity-50"
              title="Re-apply the latest restaurant-scaffold improvements (anchor nav, no FAQ, tap-to-call footer…) without touching real content"
            >
              {refreshBusy ? 'Refreshing…' : 'Refresh UX'}
            </button>
          )}
          {r.site_url && (
            <a
              href={r.site_url}
              target="_blank"
              rel="noreferrer"
              className="rounded border border-neutral-700 px-2 py-0.5 text-[11px] text-sky-300 hover:border-neutral-500"
            >
              View site ↗
            </a>
          )}
          {r.claim_url && !r.is_winner && r.status !== 'claimed' && (
            <CopyLink url={r.claim_url} label={inContest ? 'Copy contest link' : 'Copy claim link'} />
          )}
        </span>
      </td>
    </tr>
  );
}

export default function RestaurantDomainsPage() {
  const [data, setData] = React.useState<Overview | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null); // area key while acting
  const [notice, setNotice] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/admin/restaurant-domains', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `failed (${res.status})`);
      setData(json);
    } catch (e: any) {
      setError(e?.message || 'failed');
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  // NextStepButton fires this after a one-click fix runs (it also rescores the
  // template) — reload so the meter + next step reflect the change.
  React.useEffect(() => {
    const onRefetch = () => void load();
    window.addEventListener('qs:templates:refetch', onRefetch);
    return () => window.removeEventListener('qs:templates:refetch', onRefetch);
  }, [load]);

  // Pull every built, un-linked candidate in the area into the existing contest.
  const addAllToContest = async (area: Area) => {
    const ids = area.candidates.filter((c) => c.template_id).map((c) => c.id);
    if (!area.campaign_id || !ids.length) return;
    setBusy(area.key);
    setNotice(null);
    try {
      const res = await fetch('/api/admin/restaurant-domains/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId: area.campaign_id, prospectIds: ids }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `failed (${res.status})`);
      setNotice(`${json.linked.length} restaurant(s) added to the ${area.domain} contest.`);
      await load();
    } catch (e: any) {
      setError(e?.message || 'failed');
    } finally {
      setBusy(null);
    }
  };

  // "Refresh UX": re-apply the latest restaurant-scaffold improvements to one draft
  // (idempotent server-side; respects operator edits). Refreshes the row after.
  const [refreshingId, setRefreshingId] = React.useState<string | null>(null);
  const refreshUx = async (r: AreaRestaurant) => {
    if (!r.template_id) return;
    setRefreshingId(r.id);
    setError(null);
    try {
      const res = await fetch('/api/admin/restaurant-domains/refresh-ux', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: r.template_id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `failed (${res.status})`);
      setNotice(
        json.changed
          ? `${r.business_name}: applied ${json.applied.length} UX upgrade(s) — ${json.applied.join(', ').replace(/_/g, ' ')}.`
          : `${r.business_name}: already up to date.`,
      );
      if (json.changed) await load();
    } catch (e: any) {
      setError(e?.message || 'failed');
    } finally {
      setRefreshingId(null);
    }
  };

  // Suggested next apex launches — toggled panel over data already loaded.
  const [showSuggestions, setShowSuggestions] = React.useState(false);

  // Build draft ordering sites for every unbuilt restaurant in the area (cohort +
  // candidates), chunked to keep each serverless call under its OCR time budget.
  // This is the AI-spend step (menu OCR per restaurant) — hence the confirm.
  const buildDrafts = async (area: Area) => {
    const ids = [...area.competitors, ...area.candidates].filter((r) => !r.template_id).map((r) => r.id);
    if (!ids.length) return;
    if (!confirm(`Build ${ids.length} draft ordering site(s) for ${area.city}? Uses AI (menu OCR from listing photos) per restaurant.`)) return;
    setBusy(area.key);
    setError(null);
    const CHUNK = 3; // vision OCR ≈ 10–20s per restaurant; stay under the 60s route budget
    let built = 0;
    let failed = 0;
    try {
      for (let i = 0; i < ids.length; i += CHUNK) {
        setNotice(`Building drafts for ${area.city}… ${Math.min(i, ids.length)}/${ids.length}`);
        const res = await fetch('/api/admin/prospects/build', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prospectIds: ids.slice(i, i + CHUNK) }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || `failed (${res.status})`);
        const results: any[] = Array.isArray(json.results) ? json.results : [];
        built += results.filter((r) => r.ok && !r.skipped).length;
        failed += results.filter((r) => !r.ok).length;
      }
      setNotice(
        `${built} draft(s) built for ${area.city}${failed ? ` (${failed} failed)` : ''} — review menus/prices, then ${
          area.campaign_kind === 'restaurant_competition' ? 'they’re racing' : 'convert to the claim contest'
        }.`,
      );
      await load();
    } catch (e: any) {
      setError(e?.message || 'failed');
    } finally {
      setBusy(null);
    }
  };

  // Convert a legacy rent-model restaurant campaign into a first-claim-wins contest
  // (flips kind, parks the shared pitch site so the winner directory fronts the apex).
  const convertToContest = async (area: Area) => {
    if (!area.campaign_id) return;
    if (!confirm(`Convert ${area.domain} to a claim contest? The rent pitch site moves aside; the ${area.competitors.length} linked restaurants race — first to claim their own site wins the apex.`)) return;
    setBusy(area.key);
    setNotice(null);
    try {
      const res = await fetch('/api/admin/restaurant-domains/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId: area.campaign_id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `failed (${res.status})`);
      setNotice(
        `${json.domain} is now a claim contest — ${json.cohortSize} restaurants racing.${
          json.apexTemplateId ? ' Apex portal created (editable from the card).' : ''
        }${json.warning ? ` ⚠ ${json.warning}` : ''}`,
      );
      await load();
    } catch (e: any) {
      setError(e?.message || 'failed');
    } finally {
      setBusy(null);
    }
  };

  // Launch a contest from the area's built candidates (existing create endpoint; the
  // owned/derived apex is passed as the domain override).
  const createContest = async (area: Area) => {
    const ids = area.candidates.filter((c) => c.template_id).map((c) => c.id);
    if (ids.length < 2) return;
    if (!confirm(`Create the ${area.domain} contest with ${ids.length} restaurants? First to claim their site wins the domain.`)) return;
    setBusy(area.key);
    setNotice(null);
    try {
      const res = await fetch('/api/admin/prospects/restaurant-competition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prospectIds: ids, domain: area.domain, region: area.region ?? undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `failed (${res.status})`);
      setNotice(`Contest created: ${json.domain} (${json.domainStatus}) — ${json.cohortSize} competing.`);
      await load();
    } catch (e: any) {
      setError(e?.message || 'failed');
    } finally {
      setBusy(null);
    }
  };

  const t = data?.totals;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 text-white">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Restaurant location domains</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Every <span className="text-neutral-200">&lt;city&gt;-restaurant.com</span> apex, the claim contest running
            on it, and the no-website restaurants in the area you can still pull into the funnel.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 text-sm">
          <Link href="/admin/growth?tab=prospects" className="text-sky-400 underline underline-offset-4 hover:text-sky-300">
            Discover restaurants →
          </Link>
          <Link href="/admin/demand-funnel" className="text-emerald-400 underline underline-offset-4 hover:text-emerald-300">
            Demand funnel →
          </Link>
          <Link href="/admin/domains/costs" className="text-neutral-400 underline underline-offset-4 hover:text-neutral-200">
            Domain costs →
          </Link>
        </div>
      </div>

      {error && <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
      {notice && <div className="mt-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-300">{notice}</div>}

      {!data && !error && <div className="mt-8 text-sm text-neutral-500">Loading…</div>}

      {data && (
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setShowSuggestions((v) => !v)}
            className="rounded-lg border border-purple-500/40 bg-purple-500/10 px-3 py-1.5 text-sm font-medium text-purple-200 hover:bg-purple-500/20"
            title="Score the swept cities without a contest yet — built drafts, cohort size, owned domains, and review volume"
          >
            🎯 Suggest next {Math.min(5, Math.max(1, data.suggestions.length || 5))} apex locations
          </button>
          {showSuggestions && (
            <div className="mt-3 rounded-xl border border-purple-500/25 bg-purple-500/[0.04] p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Where to launch next — scored by built drafts × cohort size × owned domain × local demand
              </div>
              {data.suggestions.length === 0 ? (
                <p className="mt-2 text-sm text-neutral-400">
                  No un-contested cities with available restaurants yet —{' '}
                  <Link href="/admin/growth?tab=prospects" className="text-sky-400 hover:underline">
                    sweep a new city for restaurants →
                  </Link>
                </p>
              ) : (
                <ol className="mt-2 space-y-2">
                  {data.suggestions.map((s, i) => (
                    <li key={s.area_key} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-800 bg-neutral-900/40 px-3 py-2">
                      <div className="min-w-0">
                        <span className="mr-2 text-neutral-600">{i + 1}.</span>
                        <span className="font-medium text-white">{s.domain}</span>
                        <span className="ml-2 text-xs text-neutral-500">
                          {s.city}
                          {s.region ? `, ${s.region}` : ''}
                        </span>
                        <div className="mt-0.5 text-xs text-neutral-400">{s.rationale}</div>
                      </div>
                      <span className="inline-flex items-center gap-2">
                        <span className="text-xs tabular-nums text-purple-300" title="Launch score">
                          {s.score}
                        </span>
                        <button
                          type="button"
                          onClick={() => document.getElementById(s.area_key)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                          className="rounded border border-neutral-700 px-2 py-0.5 text-[11px] text-neutral-300 hover:border-neutral-500 hover:text-white"
                        >
                          Jump to card ↓
                        </button>
                      </span>
                    </li>
                  ))}
                </ol>
              )}
              {data.suggestions.length > 0 && data.suggestions.length < 5 && (
                <p className="mt-2 text-xs text-neutral-500">
                  Only {data.suggestions.length} un-contested cit{data.suggestions.length === 1 ? 'y' : 'ies'} swept so far —{' '}
                  <Link href="/admin/growth?tab=prospects" className="text-sky-400 hover:underline">
                    discover more cities →
                  </Link>
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {t && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Kpi label="Domains owned" value={String(t.domains_owned)} />
          <Kpi label="Contests" value={String(t.contests)} accent="text-sky-300" />
          <Kpi label="Decided (won)" value={String(t.contests_decided)} accent="text-emerald-300" />
          <Kpi label="Competing" value={String(t.restaurants_competing)} />
          <Kpi label="Available to add" value={String(t.restaurants_available)} accent="text-amber-300" />
        </div>
      )}

      <div className="mt-8 space-y-6">
        {data?.areas.map((area) => {
          const builtCandidates = area.candidates.filter((c) => c.template_id).length;
          const unbuiltCount = [...area.competitors, ...area.candidates].filter((r) => !r.template_id).length;
          return (
            <div key={area.key} id={area.key} className="scroll-mt-24 rounded-xl border border-neutral-800 bg-neutral-900/40 p-5">
              {/* Area header: domain + contest state */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  {area.directory_url ? (
                    <a href={area.directory_url} target="_blank" rel="noreferrer" className="text-lg font-semibold text-white hover:underline">
                      {area.domain} ↗
                    </a>
                  ) : (
                    <span className="text-lg font-semibold text-white">{area.domain}</span>
                  )}
                  <span className="text-sm text-neutral-500">
                    {area.city}
                    {area.region ? `, ${area.region}` : ''}
                  </span>
                  {area.campaign_id ? (
                    area.has_winner ? (
                      <Badge tone="emerald">won by {area.winner_name || 'a claimant'}</Badge>
                    ) : area.campaign_kind && area.campaign_kind !== 'restaurant_competition' ? (
                      <Badge tone="amber">rent-model campaign — not a contest yet</Badge>
                    ) : (
                      <Badge tone="purple">contest live — first claim wins</Badge>
                    )
                  ) : area.domain_owned ? (
                    <Badge tone="sky">domain owned — no contest yet</Badge>
                  ) : (
                    <Badge tone="neutral">domain not owned</Badge>
                  )}
                  {area.domain_status && <Badge tone="neutral">{area.domain_status}</Badge>}
                  {area.apex_template_id && (
                    <Link
                      href={`/admin/templates/${area.apex_template_id}`}
                      className="text-xs text-sky-400 underline underline-offset-2 hover:text-sky-300"
                      title="The apex portal template fronting this domain (hero + live directory)"
                    >
                      Edit apex site →
                    </Link>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {unbuiltCount > 0 && (
                    <button
                      type="button"
                      disabled={busy === area.key}
                      onClick={() => void buildDrafts(area)}
                      title="Build a draft ordering site for each restaurant that doesn't have one yet (AI menu OCR per restaurant)"
                      className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
                    >
                      {busy === area.key ? 'Working…' : `Build ${unbuiltCount} draft${unbuiltCount > 1 ? 's' : ''}`}
                    </button>
                  )}
                  {area.campaign_id && area.campaign_kind !== 'restaurant_competition' && !area.has_winner && (
                    <button
                      type="button"
                      disabled={busy === area.key}
                      onClick={() => void convertToContest(area)}
                      title="Flip this rent-model campaign to the first-claim-wins contest mechanic (needs 2+ linked restaurants with built sites)"
                      className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50"
                    >
                      {busy === area.key ? 'Converting…' : 'Convert to claim contest'}
                    </button>
                  )}
                  {area.campaign_id && area.campaign_kind === 'restaurant_competition' && builtCandidates > 0 && (
                    <button
                      type="button"
                      disabled={busy === area.key}
                      onClick={() => void addAllToContest(area)}
                      className="rounded-md bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-500 disabled:opacity-50"
                    >
                      {busy === area.key ? 'Adding…' : `Add ${builtCandidates} built to contest`}
                    </button>
                  )}
                  {!area.campaign_id && builtCandidates >= 2 && (
                    <button
                      type="button"
                      disabled={busy === area.key}
                      onClick={() => void createContest(area)}
                      className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                    >
                      {busy === area.key ? 'Creating…' : `Create contest (${builtCandidates} ready)`}
                    </button>
                  )}
                </div>
              </div>

              {/* Cohort in the contest */}
              {area.competitors.length > 0 && (
                <div className="mt-4">
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    In the contest ({area.competitors.length})
                  </div>
                  <table className="w-full text-sm">
                    <tbody>
                      {area.competitors.map((r) => (
                        <RestaurantRow key={r.id} r={r} inContest onRefreshUx={refreshUx} refreshBusy={refreshingId === r.id} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Available restaurants in the area */}
              {area.candidates.length > 0 && (
                <div className="mt-4">
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    No-website restaurants in {area.city} not yet in the funnel ({area.candidates.length})
                  </div>
                  <table className="w-full text-sm">
                    <tbody>
                      {area.candidates.map((r) => (
                        <RestaurantRow key={r.id} r={r} inContest={false} onRefreshUx={refreshUx} refreshBusy={refreshingId === r.id} />
                      ))}
                    </tbody>
                  </table>
                  {builtCandidates < area.candidates.length && (
                    <p className="mt-2 text-xs text-neutral-500">
                      Restaurants without a site need a draft built first —{' '}
                      <Link href="/admin/growth?tab=prospects" className="text-sky-400 hover:underline">
                        build them in the growth workspace →
                      </Link>
                    </p>
                  )}
                </div>
              )}

              {area.competitors.length === 0 && area.candidates.length === 0 && (
                <p className="mt-3 text-sm text-neutral-500">
                  No restaurants tracked in this area yet —{' '}
                  <Link href="/admin/growth?tab=prospects" className="text-sky-400 hover:underline">
                    run a discovery sweep →
                  </Link>
                </p>
              )}
            </div>
          );
        })}

        {data && data.areas.length === 0 && (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-8 text-center text-sm text-neutral-400">
            No restaurant domains or no-website restaurant prospects yet.{' '}
            <Link href="/admin/growth?tab=prospects" className="text-sky-400 hover:underline">
              Sweep a city for restaurants →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
