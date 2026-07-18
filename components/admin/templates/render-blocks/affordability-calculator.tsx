// components/admin/templates/render-blocks/affordability-calculator.tsx
'use client';

// "How much home can I afford?" — a pure client-side buyer tool for real-estate agent sites.
// Uses the standard 28/36 lending guideline to estimate a max home price + monthly payment from
// income, debts, down payment, rate, and term. Honest: it's an ESTIMATE, not a lending decision,
// and it ends in a soft CTA to talk to the agent (no data leaves the browser). Distinct from the
// mortgage_calculator block (payment-from-price); this is max-price-from-income.

import type { Block } from '@/types/blocks';
import SectionShell from '@/components/ui/section-shell';
import { useMemo, useState } from 'react';

type ThemeMode = 'light' | 'dark';

const num = (v: string) => {
  const n = Number(String(v).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
};
const usd = (n: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Math.max(0, Math.round(n)));

/** Max loan from an affordable monthly P&I payment (present value of an annuity). */
function maxLoanFromPayment(monthly: number, ratePct: number, years: number): number {
  const r = ratePct / 100 / 12;
  const n = years * 12;
  if (monthly <= 0 || n <= 0) return 0;
  if (r === 0) return monthly * n;
  return (monthly * (1 - Math.pow(1 + r, -n))) / r;
}

export default function AffordabilityCalculatorRender({
  block,
  colorMode = 'light',
}: {
  block: Block;
  colorMode?: ThemeMode;
}) {
  const c: any = (block?.content as any) ?? (block as any)?.props ?? {};
  const dark = colorMode === 'dark';
  const title = String(c.title || 'How much home can I afford?');
  const ctaLabel = String(c.cta_label || 'Talk to me about your budget');
  const ctaHref = String(c.cta_href || '#contact');

  const [income, setIncome] = useState('90000');
  const [debts, setDebts] = useState('400');
  const [down, setDown] = useState('40000');
  const [rate, setRate] = useState('7');
  const [term, setTerm] = useState('30');

  const result = useMemo(() => {
    const monthlyIncome = num(income) / 12;
    // 28/36 guideline: housing ≤ 28% of gross; total debts (housing + other) ≤ 36%.
    const frontEnd = monthlyIncome * 0.28;
    const backEnd = monthlyIncome * 0.36 - num(debts);
    const maxPayment = Math.max(0, Math.min(frontEnd, backEnd));
    // Reserve ~20% of the payment for taxes + insurance so the P&I estimate stays realistic.
    const maxPI = maxPayment * 0.8;
    const loan = maxLoanFromPayment(maxPI, num(rate), num(term));
    const price = loan + num(down);
    return { maxPayment, price };
  }, [income, debts, down, rate, term]);

  const fieldWrap = 'flex flex-col gap-1 text-left';
  const label = `text-xs font-medium ${dark ? 'text-white/60' : 'text-zinc-500'}`;
  const field = `w-full rounded-lg border px-3 py-2 text-sm ${
    dark ? 'border-white/15 bg-white/5 text-white' : 'border-zinc-300 bg-white text-zinc-900'
  }`;

  return (
    <SectionShell>
      <div id="affordability" className="mx-auto max-w-2xl scroll-mt-20">
        <h2
          className={`text-center text-2xl font-bold md:text-3xl ${dark ? 'text-white' : 'text-zinc-900'}`}
        >
          {title}
        </h2>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className={fieldWrap}>
            <span className={label}>Annual household income</span>
            <input
              className={field}
              inputMode="numeric"
              value={income}
              onChange={(e) => setIncome(e.target.value)}
            />
          </label>
          <label className={fieldWrap}>
            <span className={label}>Monthly debt payments</span>
            <input
              className={field}
              inputMode="numeric"
              value={debts}
              onChange={(e) => setDebts(e.target.value)}
            />
          </label>
          <label className={fieldWrap}>
            <span className={label}>Down payment</span>
            <input
              className={field}
              inputMode="numeric"
              value={down}
              onChange={(e) => setDown(e.target.value)}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className={fieldWrap}>
              <span className={label}>Rate %</span>
              <input
                className={field}
                inputMode="decimal"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
              />
            </label>
            <label className={fieldWrap}>
              <span className={label}>Term (yrs)</span>
              <input
                className={field}
                inputMode="numeric"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
              />
            </label>
          </div>
        </div>

        <div
          className={`mt-6 rounded-xl border p-6 text-center ${
            dark ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-emerald-300 bg-emerald-50'
          }`}
        >
          <div
            className={`text-xs uppercase tracking-wide ${dark ? 'text-emerald-300/70' : 'text-emerald-700/70'}`}
          >
            Estimated home price you can afford
          </div>
          <div
            className={`mt-1 text-4xl font-extrabold ${dark ? 'text-emerald-200' : 'text-emerald-700'}`}
          >
            {usd(result.price)}
          </div>
          <div className={`mt-1 text-sm ${dark ? 'text-white/60' : 'text-zinc-600'}`}>
            about {usd(result.maxPayment)}/mo total housing budget
          </div>
        </div>

        <div className="mt-4 text-center">
          <a
            href={ctaHref}
            className="inline-block rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500"
          >
            {ctaLabel}
          </a>
          <p className={`mt-3 text-xs ${dark ? 'text-white/40' : 'text-zinc-500'}`}>
            An estimate using the standard 28/36 guideline — not a lending decision. Actual approval
            depends on your full financial picture.
          </p>
        </div>
      </div>
    </SectionShell>
  );
}
