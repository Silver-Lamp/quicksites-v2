'use client';

// components/admin/ops/revenue-simulator.tsx
//
// A live "what-if" revenue simulator for /admin/ops. Sliders for the five levers the
// operator can actually move (domains rented, rent price, subscription seats, commerce
// volume, take-rate) drive a pure model (lib/ops/revenueSimulator.ts); the projected
// monthly + annual net updates on every drag, alongside the delta vs. today's numbers.
//
// The point is to encourage ACTION: at rest the sliders sit on the live snapshot, so
// the delta is always honest, and the one-click scenario chips ("Rent your idle
// domains", "Double your merchants") each map to a concrete move whose reward is the
// green number they produce — with a deep link to where you'd actually do it.

import { useMemo, useState } from 'react';
import {
  simulateRevenue,
  deriveSimSeed,
  SIM_SCENARIOS,
  type SimInputs,
  type SimSeedSource,
} from '@/lib/ops/revenueSimulator';
import { formatMoney, type Tone } from '@/components/admin/ops/ops-widgets';

const TONE_STROKE: Record<Tone, string> = {
  good: '#34d399',
  warn: '#f59e0b',
  bad: '#f87171',
  info: '#38bdf8',
  neutral: '#a1a1aa',
};

/** One labeled range control. `format` renders the current value; `display` overrides. */
function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
  hint?: string;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-neutral-300">{label}</span>
        <span className="text-sm font-semibold tabular-nums text-neutral-100">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1.5 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-zinc-700 accent-sky-400"
      />
      {hint ? <div className="mt-0.5 text-[10px] text-neutral-500">{hint}</div> : null}
    </label>
  );
}

/** A revenue-stream contribution row with its share bar. */
function StreamRow({ label, cents, total, tone }: { label: string; cents: number; total: number; tone: Tone }) {
  const pct = total > 0 ? Math.max(0, Math.min(100, (cents / total) * 100)) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-neutral-400">{label}</span>
        <span className="font-medium tabular-nums text-neutral-200">{formatMoney(cents)}/mo</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: TONE_STROKE[tone] }} />
      </div>
    </div>
  );
}

const dollars = (c: number) => `$${Math.round(c / 100).toLocaleString()}`;

export default function RevenueSimulator({ source }: { source: SimSeedSource }) {
  const { seed, bounds } = useMemo(() => deriveSimSeed(source), [source]);
  const [inputs, setInputs] = useState<SimInputs>(seed);
  const [activeScenario, setActiveScenario] = useState('current');

  const set = (patch: Partial<SimInputs>) => {
    setInputs((prev) => ({ ...prev, ...patch }));
    setActiveScenario('custom');
  };

  const applyScenario = (id: string) => {
    const s = SIM_SCENARIOS.find((x) => x.id === id);
    if (!s) return;
    setInputs(s.apply(seed, bounds));
    setActiveScenario(id);
  };

  const out = useMemo(() => simulateRevenue(inputs), [inputs]);
  const base = useMemo(() => simulateRevenue(seed), [seed]);

  const deltaNet = out.netMonthlyCents - base.netMonthlyCents;
  const deltaAnnual = deltaNet * 12;
  const netTone: Tone = out.netMonthlyCents >= 0 ? 'good' : 'bad';
  const grossForShare = Math.max(1, out.netCommerceCents + out.domainRentCents + out.mrrCents);

  const activeBlurb = SIM_SCENARIOS.find((s) => s.id === activeScenario)?.blurb;

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-300">Revenue simulator</h2>
          <p className="mt-1 text-xs text-neutral-500">Drag the levers, or pick a scenario. Projections update against today's numbers.</p>
        </div>
        <button
          onClick={() => applyScenario('current')}
          className="rounded-lg border border-zinc-700 px-2.5 py-1 text-xs text-neutral-300 transition hover:border-zinc-500 hover:text-neutral-100"
        >
          Reset to current
        </button>
      </div>

      {/* Scenario chips */}
      <div className="mt-4 flex flex-wrap gap-2">
        {SIM_SCENARIOS.map((s) => (
          <button
            key={s.id}
            onClick={() => applyScenario(s.id)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              activeScenario === s.id
                ? 'border-sky-500/50 bg-sky-500/15 text-sky-200'
                : 'border-zinc-700 bg-zinc-800/40 text-neutral-300 hover:border-zinc-500'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      {activeBlurb ? <p className="mt-2 text-xs text-neutral-500">{activeBlurb}</p> : null}

      <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Levers */}
        <div className="space-y-4">
          <Slider
            label="Domains rented"
            value={inputs.rentedDomains}
            min={0}
            max={Math.max(bounds.maxRentedDomains, 1)}
            step={1}
            onChange={(v) => set({ rentedDomains: v })}
            format={(v) => `${v} of ${bounds.maxRentedDomains}`}
            hint="Idle inventory ranked + rented out"
          />
          <Slider
            label="Rent per domain"
            value={inputs.avgRentCents}
            min={0}
            max={50_000}
            step={500}
            onChange={(v) => set({ avgRentCents: v })}
            format={(v) => `${dollars(v)}/mo`}
          />
          <Slider
            label="Subscription seats"
            value={inputs.subscribers}
            min={0}
            max={Math.max(200, seed.subscribers * 4)}
            step={1}
            onChange={(v) => set({ subscribers: v })}
            format={(v) => `${v} × ${dollars(inputs.avgPlanCents)}`}
          />
          <Slider
            label="Active merchants"
            value={inputs.merchants}
            min={0}
            max={Math.max(500, seed.merchants * 5)}
            step={1}
            onChange={(v) => set({ merchants: v })}
            format={(v) => v.toLocaleString()}
            hint={`× ${inputs.ordersPerMerchant} orders/mo × ${dollars(inputs.avgOrderCents)} = ${formatMoney(out.gmvCents)} GMV`}
          />
          <Slider
            label="Orders per merchant / mo"
            value={inputs.ordersPerMerchant}
            min={0}
            max={200}
            step={1}
            onChange={(v) => set({ ordersPerMerchant: v })}
            format={(v) => `${v}`}
          />
          <Slider
            label="Average order value"
            value={inputs.avgOrderCents}
            min={500}
            max={50_000}
            step={500}
            onChange={(v) => set({ avgOrderCents: v })}
            format={(v) => dollars(v)}
          />
          <Slider
            label="Platform take-rate"
            value={inputs.platformFeePct}
            min={0}
            max={30}
            step={0.5}
            onChange={(v) => set({ platformFeePct: v })}
            format={(v) => `${v}%`}
            hint={`${inputs.attributedPct}% of GMV rides a partner referral (−80% residual)`}
          />
          <Slider
            label="Referral-attributed GMV"
            value={inputs.attributedPct}
            min={0}
            max={100}
            step={5}
            onChange={(v) => set({ attributedPct: v })}
            format={(v) => `${v}%`}
          />
        </div>

        {/* Outputs */}
        <div className="space-y-4">
          <div className="rounded-xl border border-zinc-800 bg-black/20 p-5">
            <div className="text-xs uppercase tracking-wide text-neutral-500">Projected net / month</div>
            <div className={`mt-1 text-4xl font-semibold tabular-nums ${netTone === 'good' ? 'text-emerald-300' : 'text-red-300'}`}>
              {formatMoney(out.netMonthlyCents, { sign: out.netMonthlyCents > 0 })}
            </div>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-3 text-xs text-neutral-400">
              <span>{formatMoney(out.annualNetCents, { sign: out.annualNetCents > 0 })}/yr</span>
              {deltaNet !== 0 ? (
                <span className={deltaNet > 0 ? 'text-emerald-400' : 'text-red-400'}>
                  {deltaNet > 0 ? '▲' : '▼'} {formatMoney(Math.abs(deltaNet))}/mo vs current ({formatMoney(Math.abs(deltaAnnual))}/yr)
                </span>
              ) : (
                <span className="text-neutral-500">= today's baseline</span>
              )}
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-zinc-800 bg-black/20 p-4">
            <div className="text-xs uppercase tracking-wide text-neutral-500">Revenue streams</div>
            <StreamRow label="Commerce take (net of residual)" cents={out.netCommerceCents} total={grossForShare} tone="info" />
            <StreamRow label="Geo-domain rent" cents={out.domainRentCents} total={grossForShare} tone="good" />
            <StreamRow label="Subscription MRR" cents={out.mrrCents} total={grossForShare} tone="warn" />
            <div className="flex items-baseline justify-between border-t border-zinc-800 pt-2 text-xs">
              <span className="text-neutral-400">Domain renewal burn</span>
              <span className="font-medium tabular-nums text-red-300">−{formatMoney(out.monthlyBurnCents)}/mo</span>
            </div>
            <div className="flex items-baseline justify-between text-xs">
              <span className="font-medium text-neutral-300">Gross revenue</span>
              <span className="font-semibold tabular-nums text-neutral-100">{formatMoney(out.grossRevenueCents)}/mo</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <a href="/admin/growth?tab=prospects" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-medium text-emerald-200 transition hover:bg-emerald-500/20">
              Rent idle domains →
            </a>
            <a href="/admin/domains/costs" className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 font-medium text-sky-200 transition hover:bg-sky-500/20">
              Cut idle burn →
            </a>
            <a href="/admin/revenue" className="rounded-lg border border-zinc-700 bg-zinc-800/40 px-2.5 py-1 font-medium text-neutral-300 transition hover:border-zinc-500">
              Actual revenue →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
