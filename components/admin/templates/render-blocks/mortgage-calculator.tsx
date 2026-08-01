'use client';

// components/admin/templates/render-blocks/mortgage-calculator.tsx
//
// Mortgage / affordability calculator — the classic real-estate SEO + conversion
// magnet most agent sites never have (docs/BLOCKS_BACKLOG.md Tier 3 "Calculator
// block"). The block content seeds sensible defaults (this listing's price, a
// typical rate); the VISITOR tweaks price / down-payment / rate / term inline and
// watches the estimated monthly payment update live. Honest by design: it computes
// real amortization math (P&I) and only adds taxes/insurance/HOA the agent actually
// entered — and every render carries the "estimate, not a loan offer" disclaimer.
// All client-side; nothing is stored or submitted.

import * as React from 'react';
import type { Block } from '@/types/blocks';

type Props = { block?: Block; content?: Block['content'] };

const s = (v: any) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');
const numOf = (v: any, fallback = 0): number => {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : fallback;
};

const usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

/** Monthly principal + interest for a fully-amortizing loan. */
function monthlyPI(principal: number, annualRatePct: number, years: number): number {
  const n = Math.round(years * 12);
  if (principal <= 0 || n <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return principal / n;
  const f = Math.pow(1 + r, n);
  return (principal * r * f) / (f - 1);
}

export default function RenderMortgageCalculator({ block, content }: Props) {
  const c: any = content ?? block?.content ?? {};
  const title = s(c.title) || 'Estimate your monthly payment';
  const subtitle = s(c.subtitle);
  const ctaText = s(c.cta_text);
  const ctaLink = s(c.cta_link) || '#contact';
  const disclaimer =
    s(c.disclaimer) ||
    'Estimate only — not a loan offer or a commitment to lend. Actual rates, taxes, and insurance vary.';

  // Seed the interactive state from the block's defaults (the agent's listing).
  const [price, setPrice] = React.useState(() => numOf(c.price, 500000));
  const [downPct, setDownPct] = React.useState(() => numOf(c.down_payment_percent, 20));
  const [rate, setRate] = React.useState(() => numOf(c.interest_rate, 6.8));
  const [term, setTerm] = React.useState(() => numOf(c.loan_term_years, 30) || 30);

  // Extras the agent optionally configured (0 = omitted from the breakdown).
  const taxRate = numOf(c.property_tax_rate, 0);
  const insMonthly = numOf(c.home_insurance_monthly, 0);
  const hoaMonthly = numOf(c.hoa_monthly, 0);

  const downAmount = Math.round((price * downPct) / 100);
  const loanAmount = Math.max(0, price - downAmount);
  const pi = monthlyPI(loanAmount, rate, term);
  const taxMonthly = taxRate > 0 ? (price * (taxRate / 100)) / 12 : 0;
  const total = pi + taxMonthly + insMonthly + hoaMonthly;
  const hasExtras = taxMonthly > 0 || insMonthly > 0 || hoaMonthly > 0;

  const rows: Array<{ label: string; value: number }> = [
    { label: 'Principal & interest', value: pi },
    taxMonthly > 0 && { label: 'Property tax', value: taxMonthly },
    insMonthly > 0 && { label: 'Home insurance', value: insMonthly },
    hoaMonthly > 0 && { label: 'HOA', value: hoaMonthly },
  ].filter(Boolean) as Array<{ label: string; value: number }>;

  const Field = ({
    label,
    children,
    hint,
  }: {
    label: string;
    children: React.ReactNode;
    hint?: string;
  }) => (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="mt-0.5 block text-xs text-muted-foreground/80">{hint}</span>}
    </label>
  );

  const inputCls =
    'w-full rounded-md border border-input bg-background px-3 py-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary';

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-10">
      <div className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
        <div className="grid gap-6 p-6 md:grid-cols-2 md:p-8">
          {/* Inputs */}
          <div>
            <div className="mb-4 flex items-center gap-2">
              <span aria-hidden className="text-2xl">🏦</span>
              <div>
                <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
                {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
              </div>
            </div>

            <div className="space-y-3">
              <Field label="Home price">
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1000}
                  value={price || ''}
                  onChange={(e) => setPrice(numOf(e.target.value, 0))}
                  className={inputCls}
                />
              </Field>

              <Field label={`Down payment — ${downPct}% (${usd0.format(downAmount)})`}>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={downPct}
                  onChange={(e) => setDownPct(numOf(e.target.value, 0))}
                  className="w-full accent-primary"
                  aria-label="Down payment percent"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Interest rate (%)">
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={25}
                    step={0.1}
                    value={rate || ''}
                    onChange={(e) => setRate(numOf(e.target.value, 0))}
                    className={inputCls}
                  />
                </Field>
                <Field label="Loan term">
                  <select
                    value={term}
                    onChange={(e) => setTerm(numOf(e.target.value, 30) || 30)}
                    className={inputCls}
                  >
                    <option value={30}>30 years</option>
                    <option value={20}>20 years</option>
                    <option value={15}>15 years</option>
                    <option value={10}>10 years</option>
                  </select>
                </Field>
              </div>
            </div>
          </div>

          {/* Result */}
          <div className="flex flex-col justify-center rounded-xl border border-border bg-muted/40 p-6 text-center">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Estimated monthly payment
            </div>
            <div className="mt-1 text-4xl font-bold tabular-nums">
              {usd0.format(Math.round(total))}
              <span className="text-base font-medium text-muted-foreground">/mo</span>
            </div>
            {!hasExtras && (
              <div className="mt-1 text-xs text-muted-foreground">Principal &amp; interest only</div>
            )}

            <dl className="mt-4 space-y-1.5 text-left text-sm">
              {rows.map((r) => (
                <div key={r.label} className="flex items-center justify-between">
                  <dt className="text-muted-foreground">{r.label}</dt>
                  <dd className="font-medium tabular-nums">{usd0.format(Math.round(r.value))}</dd>
                </div>
              ))}
              <div className="mt-1 flex items-center justify-between border-t border-border pt-1.5">
                <dt className="text-muted-foreground">Loan amount</dt>
                <dd className="font-medium tabular-nums">{usd0.format(loanAmount)}</dd>
              </div>
            </dl>

            {ctaText && (
              <a
                href={ctaLink}
                className="mt-5 inline-flex justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow transition hover:opacity-90"
              >
                {ctaText}
              </a>
            )}
          </div>
        </div>

        <p className="border-t border-border bg-muted/30 px-6 py-3 text-center text-xs text-muted-foreground">
          {disclaimer}
        </p>
      </div>
    </section>
  );
}
