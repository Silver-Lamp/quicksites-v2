'use client';

// components/admin/domain-buy-list-planner.tsx
//
// Pre-purchase domain buy-list planner: pick industries + a budget, get a ranked list of
// the geo-domains most worth buying (leadValue × demand × winnability), with a budget-fill
// tally and optional read-only availability/price. Self-contained — calls
// POST /api/admin/prospects/buy-list. See docs/DOMAIN_ACQUISITION_PLAN.md.

import { useEffect, useMemo, useState } from 'react';
import { getIndustryOptions, type IndustryKey } from '@/lib/industries';
import { PREMIUM_INDUSTRIES, MID_INDUSTRIES, formatCents } from '@/lib/outreach/geoPricing';
import { availableMetros, citiesForMetro } from '@/lib/prospects/citySeeds';
import {
  buildOwnedIndex,
  candidateOwnedMatch,
  parseOwnedDomains,
  normalizeDomain,
  type OwnedMatch,
} from '@/lib/prospects/ownedDomains';

const OWNED_STORAGE_KEY = 'qs.buyList.ownedDomains';

type Candidate = {
  city: string;
  region: string | null;
  industryKey: string;
  domain: string;
  slug: string;
  monthlyRentCents: number;
  lockedRentCents: number;
  noWebsite: number;
  hasSite: number;
  totalProspects: number;
  saturation: number;
  competitorReviews: number | null;
  reviewSample: number;
  packStrength: number | null;
  weakPackFactor: number;
  searchVolume: number | null;
  volumeFactor: number;
  score: number;
};

type PlanResponse = {
  ok: boolean;
  budgetUsd: number;
  totalScored: number;
  returned: number;
  availabilityChecked: boolean;
  availabilityByDomain?: Record<
    string,
    { available?: boolean; priceUsd?: number | null; premium?: boolean; error?: string }
  >;
  volumeChecked: boolean;
  volumeAvailable: boolean;
  candidates: Candidate[];
  fill: {
    count: number;
    totalSpendUsd: number;
    projectedMonthlyRentCents: number;
    projectedFullMonthlyRentCents: number;
    acceptedDomains: string[];
    skipped: { domain: string; reason: string; priceUsd: number | null }[];
  };
};

type PurchaseItemResult = {
  domain: string;
  city: string;
  industryKey: string;
  status: 'bought' | 'would_buy' | 'exists' | 'skipped' | 'failed';
  reason?: string;
  priceUsd?: number | null;
  campaignId?: string;
  templateId?: string;
  claimUrl?: string;
  trackingNumber?: string | null;
  gsc?: string;
};

type PreflightCheck = { ok: boolean; detail: string };
type PreflightResult = {
  ok: boolean;
  ready: boolean;
  checks: Record<string, PreflightCheck>;
  billingReminder: string;
};

type PurchaseResponse = {
  ok: boolean;
  dryRun: boolean;
  flagEnabled: boolean;
  budgetUsd: number | null;
  spentUsd: number;
  summary: {
    bought: number;
    wouldBuy: number;
    exists: number;
    skipped: number;
    failed: number;
    numbersProvisioned?: number;
    gscConnected?: number;
    gscPending?: number;
  };
  results: PurchaseItemResult[];
};

const CHIP = 'rounded-full border px-3 py-1 text-xs font-medium transition';

/** Extract domains from a registrar CSV: first column per row, skip header, require a dot. */
function parseCsvDomains(text: string): string[] {
  const out: string[] = [];
  for (const line of (text || '').split(/\r?\n/)) {
    const first = line.split(',')[0]?.trim().replace(/^"|"$/g, '');
    if (!first || /domain\s*name/i.test(first)) continue; // blank or header
    const d = normalizeDomain(first);
    if (d && d.includes('.')) out.push(d);
  }
  return Array.from(new Set(out));
}

export default function DomainBuyListPlanner() {
  const industryOptions = useMemo(() => getIndustryOptions(), []);
  const [selected, setSelected] = useState<Set<IndustryKey>>(() => new Set(PREMIUM_INDUSTRIES));
  const [budget, setBudget] = useState(1000);
  const [metro, setMetro] = useState('');
  const [checkAvail, setCheckAvail] = useState(false);
  const [checkVol, setCheckVol] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillNote, setBackfillNote] = useState<string | null>(null);
  const [preflighting, setPreflighting] = useState(false);
  const [preflight, setPreflight] = useState<PreflightResult | null>(null);
  const [provisionNumbers, setProvisionNumbers] = useState(false);
  const [connectGsc, setConnectGsc] = useState(false);
  const [retryingGsc, setRetryingGsc] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PlanResponse | null>(null);

  const [buying, setBuying] = useState(false);
  const [buyError, setBuyError] = useState<string | null>(null);
  const [buyResult, setBuyResult] = useState<PurchaseResponse | null>(null);

  // Dedupe against domains the operator already owns (pasted, persisted; no registrar ping).
  const [ownedText, setOwnedText] = useState('');
  const [showOwnedBox, setShowOwnedBox] = useState(false);
  const [hideOwned, setHideOwned] = useState(true);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(() => new Set());

  // Load / persist the owned list.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(OWNED_STORAGE_KEY);
      if (saved) {
        setOwnedText(saved);
        setShowOwnedBox(true);
      }
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(OWNED_STORAGE_KEY, ownedText);
    } catch {
      /* ignore */
    }
  }, [ownedText]);

  const ownedIndex = useMemo(() => buildOwnedIndex(ownedText), [ownedText]);

  /** domain → owned classification ('exact' | 'similar' | null). */
  const ownedByDomain = useMemo(() => {
    const m = new Map<string, OwnedMatch>();
    for (const c of result?.candidates ?? [])
      m.set(c.domain, candidateOwnedMatch({ domain: c.domain, city: c.city, industryKey: c.industryKey }, ownedIndex));
    return m;
  }, [result, ownedIndex]);

  const metros = useMemo(() => availableMetros(), []);

  function toggle(key: IndustryKey) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function plan() {
    setLoading(true);
    setError(null);
    setBuyResult(null);
    setBuyError(null);
    try {
      const cities = metro ? citiesForMetro(metro).map((c) => ({ city: c.city, region: c.region })) : [];
      const res = await fetch('/api/admin/prospects/buy-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          industries: [...selected],
          budgetUsd: budget,
          cities,
          checkAvailability: checkAvail,
          checkVolume: checkVol,
          maxCandidates: 150,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || `Request failed (${res.status})`);
      setResult(json as PlanResponse);
    } catch (e: any) {
      setError(e?.message || 'Failed to plan the buy-list');
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  // Refresh competitor review data (rating/review_count) for already-swept prospects so the
  // map-pack column populates. Paid Places SKU → bounded server-side; re-plans on success.
  async function backfillSignals() {
    setBackfilling(true);
    setBackfillNote(null);
    try {
      const res = await fetch('/api/admin/prospects/backfill-signals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 200 }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        if (json?.error === 'place_details_not_configured') {
          throw new Error('Place Details is off — set GOOGLE_PLACES_API_KEY.');
        }
        throw new Error(json?.error || `Request failed (${res.status})`);
      }
      const r = json.result;
      setBackfillNote(
        `Backfilled ${r.updated} of ${r.checked} stale market(s)` +
          (r.deferred ? ` · ${r.deferred} deferred (run again)` : '') +
          (result ? ' · re-planning…' : ''),
      );
      if (result) await plan();
    } catch (e: any) {
      setBackfillNote(e?.message || 'Backfill failed');
    } finally {
      setBackfilling(false);
    }
  }

  // Check the Vercel registrar is actually usable (token scope, project, domains API,
  // registrant, flag) — diagnoses "everything says Taken" (a failing domains-API call).
  async function runPreflight() {
    setPreflighting(true);
    try {
      const res = await fetch('/api/domains/preflight');
      const json = await res.json();
      if (res.ok && json?.checks) setPreflight(json as PreflightResult);
      else setPreflight({ ok: false, ready: false, checks: { request: { ok: false, detail: json?.error || `Failed (${res.status})` } }, billingReminder: '' });
    } catch (e: any) {
      setPreflight({ ok: false, ready: false, checks: { request: { ok: false, detail: e?.message || 'Request failed' } }, billingReminder: '' });
    } finally {
      setPreflighting(false);
    }
  }

  // Import owned domains from a registrar CSV export (e.g. Namecheap's Domain_List.csv).
  // Takes the first column per row, skips the header, merges with anything already listed.
  function importOwnedCsv(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const csvDomains = parseCsvDomains(String(reader.result || ''));
      const existing = parseOwnedDomains(ownedText);
      const merged = Array.from(new Set([...existing, ...csvDomains]));
      setOwnedText(merged.join('\n'));
      setShowOwnedBox(true);
    };
    reader.readAsText(file);
  }

  const acceptedSet = useMemo(
    () => new Set(result?.fill.acceptedDomains ?? []),
    [result],
  );

  // Default the selection to budget-fitting AND not-already-owned whenever the plan or the
  // owned list changes. The operator can then check/uncheck rows freely.
  useEffect(() => {
    const next = new Set<string>();
    for (const c of result?.candidates ?? []) {
      if (acceptedSet.has(c.domain) && !ownedByDomain.get(c.domain)) next.add(c.domain);
    }
    setSelectedRows(next);
  }, [result, acceptedSet, ownedByDomain]);

  /** Candidates visible in the table (owned rows hidden when the toggle is on). */
  const visibleCandidates = useMemo(
    () => (result?.candidates ?? []).filter((c) => !(hideOwned && ownedByDomain.get(c.domain))),
    [result, hideOwned, ownedByDomain],
  );

  const ownedCount = useMemo(
    () => (result?.candidates ?? []).filter((c) => ownedByDomain.get(c.domain)).length,
    [result, ownedByDomain],
  );

  /** The checked candidates, as purchase items. */
  const selectedItems = useMemo(
    () =>
      (result?.candidates ?? [])
        .filter((c) => selectedRows.has(c.domain))
        .map((c) => ({ city: c.city, region: c.region, industryKey: c.industryKey })),
    [result, selectedRows],
  );

  function toggleRow(domain: string) {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });
  }

  function setAllVisible(on: boolean) {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      for (const c of visibleCandidates) {
        if (on) next.add(c.domain);
        else next.delete(c.domain);
      }
      return next;
    });
  }

  async function buy(dryRun: boolean) {
    if (!selectedItems.length) return;
    if (!dryRun) {
      const ok = window.confirm(
        `Buy ${selectedItems.length} domain(s) for up to $${budget}? This spends real money and mints a geo-campaign per domain.`,
      );
      if (!ok) return;
    }
    setBuying(true);
    setBuyError(null);
    try {
      const res = await fetch('/api/admin/prospects/buy-list/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: selectedItems, budgetUsd: budget, dryRun, provisionNumbers, connectGsc }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        if (json?.error === 'registration_disabled') {
          throw new Error('Purchasing is off. Set VERCEL_DOMAIN_REGISTER_ENABLED=1 (after the geo-engine smoke test).');
        }
        if (json?.error === 'missing_registrant_contact') {
          throw new Error(`Registrant contact incomplete: ${(json.missing || []).join(', ')}`);
        }
        throw new Error(json?.error || `Request failed (${res.status})`);
      }
      setBuyResult(json as PurchaseResponse);
    } catch (e: any) {
      setBuyError(e?.message || 'Purchase failed');
    } finally {
      setBuying(false);
    }
  }

  // Retry GSC verification for domains left 'pending' by the buy (once DNS has propagated).
  async function retryPendingGsc() {
    if (!buyResult) return;
    const pending = buyResult.results.filter((r) => r.gsc === 'pending');
    if (!pending.length) return;
    setRetryingGsc(true);
    try {
      const updates = new Map<string, string>();
      for (const r of pending) {
        try {
          const res = await fetch('/api/admin/prospects/gsc-connect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ domain: r.domain, retry: true }),
          });
          const json = await res.json();
          const rr = json?.result;
          updates.set(r.domain, rr?.verified && !rr?.pending ? 'connected' : rr?.pending ? 'pending' : 'failed');
        } catch {
          updates.set(r.domain, 'pending');
        }
      }
      setBuyResult((prev) => {
        if (!prev) return prev;
        const results = prev.results.map((r) =>
          updates.has(r.domain) ? { ...r, gsc: updates.get(r.domain) } : r,
        );
        return {
          ...prev,
          results,
          summary: {
            ...prev.summary,
            gscConnected: results.filter((r) => r.gsc === 'connected').length,
            gscPending: results.filter((r) => r.gsc === 'pending').length,
          },
        };
      });
    } finally {
      setRetryingGsc(false);
    }
  }

  return (
    <div id="buy-list-planner" className="mt-8 scroll-mt-24 rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
            Domain buy-list planner
          </h2>
          <p className="mt-1 text-xs text-neutral-500">
            Spend a fixed budget on the domains most worth owning — ranked by lead value × demand ×
            how winnable the SEO is. Availability is read-only (nothing is purchased here).
          </p>
        </div>
      </div>

      {/* Industry chips */}
      <div className="mt-4">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-neutral-400">Industries</label>
          <div className="flex gap-2 text-[11px] text-neutral-500">
            <button className="hover:text-neutral-300" onClick={() => setSelected(new Set(PREMIUM_INDUSTRIES))}>
              Premium only
            </button>
            <span>·</span>
            <button
              className="hover:text-neutral-300"
              onClick={() => setSelected(new Set([...PREMIUM_INDUSTRIES, ...MID_INDUSTRIES]))}
            >
              + Mid tier
            </button>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {industryOptions.map((opt) => {
            const on = selected.has(opt.value);
            return (
              <button
                key={opt.value}
                onClick={() => toggle(opt.value)}
                className={
                  CHIP +
                  ' ' +
                  (on
                    ? 'border-sky-500 bg-sky-600/20 text-sky-200'
                    : 'border-neutral-700 bg-neutral-950 text-neutral-400 hover:text-neutral-200')
                }
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Controls */}
      <div className="mt-4 flex flex-wrap items-end gap-4">
        <div>
          <label className="text-xs font-medium text-neutral-400">Budget (USD)</label>
          <input
            type="number"
            min={0}
            value={budget}
            onChange={(e) => setBudget(Math.max(0, Number(e.target.value) || 0))}
            className="mt-1 block w-32 rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-neutral-400">Add metro cities (optional)</label>
          <select
            value={metro}
            onChange={(e) => setMetro(e.target.value)}
            className="mt-1 block w-44 rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white"
          >
            <option value="">Swept cities only</option>
            {metros.map((m) => (
              <option key={m} value={m}>
                {m[0].toUpperCase() + m.slice(1)} metro
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-xs text-neutral-400">
          <input type="checkbox" checked={checkAvail} onChange={(e) => setCheckAvail(e.target.checked)} />
          Check availability + price (slower)
        </label>
        <label className="flex items-center gap-2 text-xs text-neutral-400" title="Needs KEYWORD_VOLUME_ENABLED + DataForSEO creds. Costs money per batch.">
          <input type="checkbox" checked={checkVol} onChange={(e) => setCheckVol(e.target.checked)} />
          Add search volume
        </label>
        <button
          onClick={plan}
          disabled={loading || selected.size === 0}
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
        >
          {loading ? 'Planning…' : 'Plan buy-list'}
        </button>
        <button
          onClick={backfillSignals}
          disabled={backfilling}
          title="Fetch competitor rating + review counts (Google Place Details) for already-swept cities so the Map pack column populates. Paid SKU; bounded per run."
          className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-300 hover:text-white disabled:opacity-50"
        >
          {backfilling ? 'Backfilling…' : 'Backfill map-pack data'}
        </button>
        <button
          onClick={runPreflight}
          disabled={preflighting}
          title="Check the Vercel registrar is usable (token scope, project, domains API, registrant, buy flag). Diagnoses false 'Taken' results."
          className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-300 hover:text-white disabled:opacity-50"
        >
          {preflighting ? 'Checking…' : 'Check registrar access'}
        </button>
      </div>

      {backfillNote && <p className="mt-2 text-[11px] text-neutral-400">{backfillNote}</p>}

      {preflight && (
        <div className="mt-3 rounded-lg border border-neutral-800 bg-neutral-950/60 p-3">
          <div className="mb-1.5 text-xs font-semibold text-neutral-300">
            Registrar readiness:{' '}
            <span className={preflight.ready ? 'text-emerald-400' : 'text-amber-400'}>
              {preflight.ready ? 'ready to buy' : 'not ready'}
            </span>
          </div>
          <ul className="space-y-0.5 text-[12px]">
            {Object.entries(preflight.checks).map(([key, c]) => (
              <li key={key} className="flex gap-2">
                <span className={c.ok ? 'text-emerald-400' : 'text-rose-400'}>{c.ok ? '✓' : '✗'}</span>
                <span className="text-neutral-500">{key}:</span>
                <span className="text-neutral-400">{c.detail}</span>
              </li>
            ))}
          </ul>
          {!preflight.checks.domainsApi?.ok && (
            <p className="mt-1.5 text-[11px] text-amber-400/90">
              A failing <code>domainsApi</code> check is why domains show as “Taken/Unknown” — the
              token can’t reach <code>/v4/domains</code>. Use a Vercel token with domain access.
            </p>
          )}
          {preflight.billingReminder && (
            <p className="mt-1.5 text-[11px] text-neutral-600">{preflight.billingReminder}</p>
          )}
        </div>
      )}

      {/* Already-owned inventory (pasted, persisted locally; no registrar ping) */}
      <div className="mt-3">
        <button
          onClick={() => setShowOwnedBox((v) => !v)}
          className="text-xs text-neutral-400 hover:text-neutral-200"
        >
          {showOwnedBox ? '▾' : '▸'} Domains I already own
          {ownedIndex.count > 0 ? ` (${ownedIndex.count})` : ''}
        </button>
        {showOwnedBox && (
          <div className="mt-2">
            <div className="mb-1.5 flex items-center gap-3">
              <label className="cursor-pointer rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-[11px] text-neutral-300 hover:text-white">
                Import CSV
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) importOwnedCsv(f);
                    e.target.value = ''; // allow re-importing the same file
                  }}
                />
              </label>
              <span className="text-[11px] text-neutral-600">
                Namecheap / registrar export — takes the first column, dedupes, merges.
              </span>
            </div>
            <textarea
              value={ownedText}
              onChange={(e) => setOwnedText(e.target.value)}
              placeholder="Paste domains you already own — one per line or comma-separated, or Import CSV. Matches ignore the dash + TLD (gallatin-towing.com ≈ gallatintowing.com ≈ gallatintowing.net) + common abbreviations (covingtontow ≈ covington-towing)."
              rows={5}
              className="block w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-xs text-neutral-200"
            />
            <p className="mt-1 text-[11px] text-neutral-600">
              Stored in your browser only. Owned matches are unchecked by default so you never
              re-buy them.
            </p>
          </div>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}

      {result && (
        <div className="mt-5">
          {/* Fill summary */}
          <div className="flex flex-wrap gap-4 rounded-lg border border-neutral-800 bg-neutral-950/60 p-3 text-sm">
            <Stat label="Domains to buy" value={String(result.fill.count)} />
            <Stat label="Spend" value={`$${result.fill.totalSpendUsd.toLocaleString()}`} />
            <Stat
              label="Founder MRR (pre-rank)"
              value={formatCents(result.fill.projectedMonthlyRentCents)}
              hint="if every domain rents at the locked rate"
            />
            <Stat
              label="Full MRR (if all rank)"
              value={formatCents(result.fill.projectedFullMonthlyRentCents)}
              hint="if every domain reaches page 1"
            />
            <Stat label="Scored" value={`${result.returned} of ${result.totalScored}`} />
            <Stat
              label="Map-pack data"
              value={`${result.candidates.filter((c) => c.reviewSample > 0).length} of ${result.candidates.length}`}
              hint="candidates with competitor review data (drives pack-strength scoring)"
            />
            {result.availabilityChecked && (() => {
              const infos = result.candidates.map((c) => result.availabilityByDomain?.[c.domain]);
              const avail = infos.filter((i) => i && !i.error && i.available === true).length;
              const taken = infos.filter((i) => i && !i.error && i.available === false).length;
              const unknown = infos.filter((i) => !i || i.error).length;
              return (
                <Stat
                  label="Availability"
                  value={`${avail} avail · ${taken} taken · ${unknown} unknown`}
                  hint={unknown > 0 ? 'Unknown = the registrar check failed (auth/rate-limit), not registered' : undefined}
                />
              );
            })()}
          </div>

          {checkVol && !result.volumeChecked && (
            <p className="mt-2 text-[11px] text-amber-400/80">
              Search volume is off — set KEYWORD_VOLUME_ENABLED=1 + DATAFORSEO_LOGIN/PASSWORD to
              enable it. Scoring proceeds without it.
            </p>
          )}

          {/* Buy action bar */}
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-950/40 p-3">
            <span className="text-xs text-neutral-400">
              {selectedItems.length} selected
              {ownedCount > 0 ? ` · ${ownedCount} already owned` : ''}:
            </span>
            <button
              onClick={() => buy(true)}
              disabled={buying || selectedItems.length === 0}
              className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-200 hover:text-white disabled:opacity-50"
            >
              {buying ? 'Working…' : 'Preview buy (dry run)'}
            </button>
            <button
              onClick={() => buy(false)}
              disabled={buying || selectedItems.length === 0}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              Buy + mint campaigns
            </button>
            {ownedCount > 0 && (
              <label className="flex items-center gap-1.5 text-[11px] text-neutral-400">
                <input type="checkbox" checked={hideOwned} onChange={(e) => setHideOwned(e.target.checked)} />
                Hide owned
              </label>
            )}
            <label
              className="flex items-center gap-1.5 text-[11px] text-neutral-400"
              title="Buy a Twilio call-tracking number per domain (recurring cost). Needs CALL_TRACKING_ENABLED + CALL_TRACKING_FALLBACK_NUMBER."
            >
              <input type="checkbox" checked={provisionNumbers} onChange={(e) => setProvisionNumbers(e.target.checked)} />
              + call tracking
            </label>
            <label
              className="flex items-center gap-1.5 text-[11px] text-neutral-400"
              title="Auto-connect each domain to Google Search Console (DNS-TXT verify). Needs GSC_AUTO_CONNECT_ENABLED + a GSC re-consent with write scope. DNS may leave some 'pending' to retry."
            >
              <input type="checkbox" checked={connectGsc} onChange={(e) => setConnectGsc(e.target.checked)} />
              + connect GSC
            </label>
            <span className="text-[11px] text-neutral-600">
              Real buy needs VERCEL_DOMAIN_REGISTER_ENABLED (post geo-engine smoke test).
            </span>
          </div>

          {buyError && <p className="mt-2 text-sm text-rose-400">{buyError}</p>}

          {buyResult && (
            <div className="mt-3 rounded-lg border border-neutral-800 bg-neutral-950/60 p-3">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="font-semibold text-neutral-100">
                  {buyResult.dryRun ? 'Dry run' : 'Purchase complete'}
                </span>
                <span className="text-neutral-400">
                  {buyResult.dryRun
                    ? `${buyResult.summary.wouldBuy} would buy · ~$${buyResult.spentUsd}`
                    : `${buyResult.summary.bought} bought · $${buyResult.spentUsd} spent`}
                </span>
                {buyResult.summary.exists > 0 && (
                  <span className="text-neutral-500">{buyResult.summary.exists} already existed</span>
                )}
                {!buyResult.dryRun && (buyResult.summary.numbersProvisioned ?? 0) > 0 && (
                  <span className="text-sky-400">{buyResult.summary.numbersProvisioned} tracking #s</span>
                )}
                {!buyResult.dryRun && (buyResult.summary.gscConnected ?? 0) > 0 && (
                  <span className="text-emerald-400">{buyResult.summary.gscConnected} GSC connected</span>
                )}
                {!buyResult.dryRun && (buyResult.summary.gscPending ?? 0) > 0 && (
                  <>
                    <span className="text-amber-400">{buyResult.summary.gscPending} GSC pending</span>
                    <button
                      onClick={retryPendingGsc}
                      disabled={retryingGsc}
                      title="Re-verify pending domains once their DNS TXT has propagated"
                      className="rounded border border-neutral-700 bg-neutral-900 px-2 py-0.5 text-[11px] text-neutral-300 hover:text-white disabled:opacity-50"
                    >
                      {retryingGsc ? 'Retrying…' : 'Retry GSC'}
                    </button>
                  </>
                )}
                {buyResult.summary.skipped > 0 && (
                  <span className="text-amber-400">{buyResult.summary.skipped} skipped</span>
                )}
                {buyResult.summary.failed > 0 && (
                  <span className="text-rose-400">{buyResult.summary.failed} failed</span>
                )}
              </div>
              <ul className="mt-2 space-y-0.5 text-[12px] text-neutral-400">
                {buyResult.results.map((r) => (
                  <li key={r.domain || `${r.city}-${r.industryKey}`}>
                    <span className="text-neutral-300">{r.domain || `${r.city} / ${r.industryKey}`}</span> —{' '}
                    <span
                      className={
                        r.status === 'bought' || r.status === 'would_buy'
                          ? 'text-emerald-400'
                          : r.status === 'failed'
                            ? 'text-rose-400'
                            : 'text-neutral-500'
                      }
                    >
                      {r.status}
                      {r.reason ? ` (${r.reason})` : ''}
                    </span>
                    {r.campaignId && !buyResult.dryRun && (
                      <a
                        href={r.templateId ? `/admin/templates/${r.templateId}` : '#'}
                        className="ml-2 text-sky-400 hover:text-sky-300"
                      >
                        open →
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Ranked table */}
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-[11px] uppercase tracking-wide text-neutral-500">
                <tr className="border-b border-neutral-800">
                  <th className="py-2 pr-3">
                    <input
                      type="checkbox"
                      aria-label="Select all visible"
                      checked={visibleCandidates.length > 0 && visibleCandidates.every((c) => selectedRows.has(c.domain))}
                      onChange={(e) => setAllVisible(e.target.checked)}
                    />
                  </th>
                  <th className="py-2 pr-3">#</th>
                  <th className="py-2 pr-3">Domain</th>
                  {ownedIndex.count > 0 && <th className="py-2 pr-3">Owned?</th>}
                  <th className="py-2 pr-3">Industry</th>
                  <th className="py-2 pr-3 text-right">$/mo</th>
                  <th className="py-2 pr-3 text-right">No-site</th>
                  <th className="py-2 pr-3 text-right">Saturation</th>
                  <th className="py-2 pr-3">Map pack</th>
                  {result.volumeChecked && <th className="py-2 pr-3 text-right">Vol/mo</th>}
                  {result.availabilityChecked && <th className="py-2 pr-3">Availability</th>}
                  <th className="py-2 pr-3 text-right">Score</th>
                </tr>
              </thead>
              <tbody>
                {visibleCandidates.map((c, i) => {
                  const isSelected = selectedRows.has(c.domain);
                  const owned = ownedByDomain.get(c.domain);
                  const inBudget = acceptedSet.has(c.domain);
                  return (
                    <tr
                      key={c.domain}
                      className={
                        'border-b border-neutral-900 ' +
                        (owned ? 'opacity-40' : isSelected ? 'bg-emerald-500/5' : 'opacity-70')
                      }
                    >
                      <td className="py-2 pr-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRow(c.domain)}
                          aria-label={`Select ${c.domain}`}
                        />
                      </td>
                      <td className="py-2 pr-3 text-neutral-500">{i + 1}</td>
                      <td className="py-2 pr-3 font-medium text-neutral-200">
                        {inBudget && !owned && (
                          <span className="mr-1 text-emerald-400" title="Fits the budget">●</span>
                        )}
                        {c.domain}
                        <span className="ml-2 text-[11px] text-neutral-500">
                          {c.city}
                          {c.region ? `, ${c.region}` : ''}
                        </span>
                      </td>
                      {ownedIndex.count > 0 && (
                        <td className="py-2 pr-3">
                          {owned === 'exact' ? (
                            <Badge cls="bg-neutral-700 text-neutral-200" text="Owned" />
                          ) : owned === 'similar' ? (
                            <Badge cls="bg-amber-900/40 text-amber-300" text="Similar" />
                          ) : owned === 'alias' ? (
                            <Badge cls="bg-amber-900/40 text-amber-300" text="Alias" />
                          ) : (
                            <span className="text-neutral-700">—</span>
                          )}
                        </td>
                      )}
                      <td className="py-2 pr-3 text-neutral-400">{labelFor(c.industryKey, industryOptions)}</td>
                      <td className="py-2 pr-3 text-right text-neutral-300">{formatCents(c.monthlyRentCents)}</td>
                      <td className="py-2 pr-3 text-right text-neutral-400">{c.noWebsite}</td>
                      <td className="py-2 pr-3 text-right text-neutral-500">
                        {c.totalProspects ? `${Math.round(c.saturation * 100)}%` : '—'}
                      </td>
                      <td className="py-2 pr-3">{packBadge(c)}</td>
                      {result.volumeChecked && (
                        <td className="py-2 pr-3 text-right text-neutral-400">
                          {c.searchVolume != null ? c.searchVolume.toLocaleString() : '—'}
                        </td>
                      )}
                      {result.availabilityChecked && (
                        <td className="py-2 pr-3">{availabilityBadge(c.domain, result)}</td>
                      )}
                      <td className="py-2 pr-3 text-right text-neutral-500">{Math.round(c.score).toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-neutral-600">
            ● = fits the budget (checked by default). Check/uncheck any row to curate the buy — only
            checked rows are purchased. Owned matches (exact or dash/TLD-insensitive) are unchecked and
            can be hidden. Real buy needs the geo-engine smoke test (see the plan doc).
          </p>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div title={hint}>
      <div className="text-[11px] uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="text-base font-semibold text-neutral-100">{value}</div>
    </div>
  );
}

function labelFor(key: string, opts: ReadonlyArray<{ value: string; label: string }>): string {
  return opts.find((o) => o.value === key)?.label ?? key;
}

// Three-state availability from the registrar check. An errored probe (403/429/timeout) is
// "Unknown" — NOT "Taken" — so a rate-limited batch never looks like everything's registered.
function availabilityBadge(domain: string, result: PlanResponse) {
  const info = result.availabilityByDomain?.[domain];
  if (!info) return <span className="text-neutral-700">—</span>;
  if (info.error) return <Badge cls="bg-neutral-700 text-neutral-300" text="Unknown" />;
  if (info.available === false) return <Badge cls="bg-rose-900/40 text-rose-300" text="Taken" />;
  if (info.premium) return <Badge cls="bg-amber-900/40 text-amber-300" text="Premium" />;
  if (info.available === true) return <Badge cls="bg-emerald-900/40 text-emerald-300" text="Available" />;
  return <span className="text-neutral-700">—</span>;
}

function Badge({ cls, text }: { cls: string; text: string }) {
  return <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${cls}`}>{text}</span>;
}

// Map-pack strength from competitor review counts: weak pack = softer target to enter.
function packBadge(c: { reviewSample: number; competitorReviews: number | null; packStrength: number | null }) {
  if (!c.reviewSample || c.packStrength == null || c.competitorReviews == null) {
    return <span className="text-neutral-700" title="No competitor review data yet">—</span>;
  }
  const label =
    c.packStrength < 0.35 ? { cls: 'bg-emerald-900/40 text-emerald-300', text: 'Weak' }
    : c.packStrength < 0.6 ? { cls: 'bg-amber-900/40 text-amber-300', text: 'Medium' }
    : { cls: 'bg-rose-900/40 text-rose-300', text: 'Strong' };
  const reviews = Math.round(c.competitorReviews);
  return (
    <span title={`Median competitor reviews: ${reviews} (${c.reviewSample} with data)`}>
      <Badge cls={label.cls} text={label.text} />
      <span className="ml-1.5 text-[11px] text-neutral-500">{reviews} rev</span>
    </span>
  );
}
