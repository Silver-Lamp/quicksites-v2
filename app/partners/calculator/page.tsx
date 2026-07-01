'use client';

// Partner earnings calculator — the competitive weapon behind
// docs/COMPETITIVE_LANDSCAPE.md §7: agency builders (Duda) charge a flat
// per-site SaaS fee and the reseller's margin is a fixed markup that does NOT
// scale with their merchants' sales; QuickSites pays the partner a residual
// share of every order, so earnings compound with GMV. This page makes that
// contrast tangible and interactive.

import * as React from 'react';
import Link from 'next/link';
import SiteHeader from '@/components/site/site-header';

// Defaults mirror lib/commerce/partner-terms.ts (which reads QS_* env, not
// available in a client bundle). Kept local like app/pricing/page.tsx does.
const PARTNER_FEE_SHARE = 0.8; // partner keeps 80% of the order fee
const MAX_FEE_PCT = 0.1; // fee capped at 10% per order

// Duda reference point (docs/COMPETITIVE_LANDSCAPE.md §3): White Label is
// $149/mo for 4 sites, ~$17/extra site. The agency's own margin is whatever
// flat markup they add per site — it does not move with merchant GMV.
const DUDA_WL_BASE = 149;
const DUDA_WL_INCLUDED_SITES = 4;
const DUDA_PER_EXTRA_SITE = 17;

const money = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
    Number.isFinite(n) ? n : 0,
  );

function Field({
  label,
  value,
  onChange,
  min,
  max,
  step,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  step: number;
  suffix?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="text-sm text-zinc-300">{label}</label>
        <span className="text-sm font-medium tabular-nums text-white">
          {suffix === '%' ? `${(value * 100).toFixed(1)}%` : suffix === '$' ? money(value) : value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-sky-500"
      />
    </div>
  );
}

export default function PartnerCalculator() {
  const [merchants, setMerchants] = React.useState(10);
  const [gmvPerMerchant, setGmvPerMerchant] = React.useState(4000); // $/merchant/mo
  const [feePct, setFeePct] = React.useState(0.08);
  const [dudaMarkupPerSite, setDudaMarkupPerSite] = React.useState(40); // $/site/mo markup

  // QuickSites: partner residual = GMV × fee% × partner share, on every order,
  // recurring for the life of the merchant.
  const totalGmv = merchants * gmvPerMerchant;
  const qsMonthly = totalGmv * feePct * PARTNER_FEE_SHARE;
  const qsAnnual = qsMonthly * 12;

  // Duda-style: agency pays the white-label base (+ extra sites) and keeps a
  // fixed markup per site. Earnings are flat — independent of merchant sales.
  const dudaCost = DUDA_WL_BASE + Math.max(0, merchants - DUDA_WL_INCLUDED_SITES) * DUDA_PER_EXTRA_SITE;
  const dudaMonthly = merchants * dudaMarkupPerSite - dudaCost;
  const dudaAnnual = dudaMonthly * 12;

  const delta = qsAnnual - dudaAnnual;

  return (
    <>
      <SiteHeader sticky />
      <main className="mx-auto max-w-4xl px-6 py-14 text-white">
        <div className="text-center">
          <div className="text-xs uppercase tracking-wide text-sky-400">Partner earnings</div>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">You earn on every sale — not a flat markup</h1>
          <p className="mx-auto mt-3 max-w-xl text-zinc-400">
            Agency builders charge you a monthly fee and cap your upside at whatever markup you add. QuickSites pays
            you {Math.round(PARTNER_FEE_SHARE * 100)}% of the order fee on everything your merchants sell — for life.
            Move the sliders.
          </p>
        </div>

        <div className="mt-10 grid gap-8 md:grid-cols-2">
          {/* Inputs */}
          <div className="space-y-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
            <Field label="Merchants you bring" value={merchants} onChange={setMerchants} min={1} max={200} step={1} />
            <Field
              label="Avg monthly sales / merchant"
              value={gmvPerMerchant}
              onChange={setGmvPerMerchant}
              min={0}
              max={50000}
              step={500}
              suffix="$"
            />
            <Field
              label="Per-order fee you set"
              value={feePct}
              onChange={setFeePct}
              min={0}
              max={MAX_FEE_PCT}
              step={0.005}
              suffix="%"
            />
            <div className="border-t border-zinc-800 pt-6">
              <Field
                label="Your markup / site on a flat-SaaS builder"
                value={dudaMarkupPerSite}
                onChange={setDudaMarkupPerSite}
                min={0}
                max={200}
                step={5}
                suffix="$"
              />
              <p className="mt-2 text-xs text-zinc-500">
                For the comparison: a white-label builder (e.g. Duda) costs ~{money(DUDA_WL_BASE)}/mo for{' '}
                {DUDA_WL_INCLUDED_SITES} sites; your margin is this fixed markup — it doesn't grow when your merchants
                sell more.
              </p>
            </div>
          </div>

          {/* Results */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-sky-500/40 bg-sky-500/5 p-6">
              <div className="text-xs uppercase tracking-wide text-sky-300">QuickSites — residual on GMV</div>
              <div className="mt-1 text-4xl font-bold tabular-nums">{money(qsMonthly)}<span className="text-base font-normal text-zinc-400">/mo</span></div>
              <div className="mt-1 text-sm text-zinc-400">{money(qsAnnual)}/yr · {Math.round(PARTNER_FEE_SHARE * 100)}% of a {(feePct * 100).toFixed(1)}% fee on {money(totalGmv)} monthly GMV</div>
              <div className="mt-2 text-xs text-sky-300/80">Recurring for the life of each merchant — it grows as they grow.</div>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
              <div className="text-xs uppercase tracking-wide text-zinc-400">Flat-SaaS builder — fixed markup</div>
              <div className="mt-1 text-4xl font-bold tabular-nums text-zinc-300">{money(dudaMonthly)}<span className="text-base font-normal text-zinc-500">/mo</span></div>
              <div className="mt-1 text-sm text-zinc-500">{money(dudaAnnual)}/yr · {money(merchants * dudaMarkupPerSite)} markup − {money(dudaCost)} platform cost</div>
              <div className="mt-2 text-xs text-zinc-500">Flat — the same whether your merchants sell {money(0)} or {money(totalGmv)}.</div>
            </div>

            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5 text-center">
              <div className="text-xs uppercase tracking-wide text-emerald-300">Difference</div>
              <div className={`mt-1 text-2xl font-bold tabular-nums ${delta >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                {delta >= 0 ? '+' : ''}{money(delta)}/yr
              </div>
              <div className="mt-1 text-xs text-zinc-400">with QuickSites vs. a flat-markup builder, at this volume</div>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center gap-3">
          <Link
            href="/partners/dashboard"
            className="rounded-lg bg-sky-500 px-6 py-3 text-base font-medium text-zinc-950 shadow-lg transition hover:bg-sky-400"
          >
            Become a partner — get your link
          </Link>
          <Link href="/partners" className="text-sm text-zinc-400 underline underline-offset-4 hover:text-zinc-200">
            ← Partner program terms
          </Link>
        </div>

        <p className="mx-auto mt-8 max-w-xl text-center text-xs text-zinc-500">
          Estimate only. QuickSites residual = your merchants' order volume × the per-order fee you set (up to{' '}
          {Math.round(MAX_FEE_PCT * 100)}%) × your {Math.round(PARTNER_FEE_SHARE * 100)}% share. Actual earnings depend
          on real sales.
        </p>
      </main>
    </>
  );
}
