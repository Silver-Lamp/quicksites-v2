'use client';

// components/commissions/scenario-lab.tsx
//
// Interactive scenario sliders for commission decisions that are NOT YET MADE — built for /for-amy
// but deliberately generic, so /for-sales, /for-angela and /admin/splits can mount the same thing
// rather than growing three calculators that disagree.
//
// ⚠️ EVERY CONSTANT ARRIVES AS A PROP FROM THE SERVER, AND THAT IS THE POINT.
// `lib/commerce/partner-terms.ts` reads `QS_*` env at module load. In a client bundle those reads
// resolve to `undefined`, so the module silently falls back to its DEFAULTS — which means a
// client-side calculator would keep quoting 80/20 even on a deploy where the owner had changed it.
// The repo already carries one workaround for this (`lib/commerce/partnerEarnings.ts`, a hand-kept
// mirror whose own test imports its constants FROM the mirror, so nothing actually pins it to the
// source). Passing props instead removes the problem rather than mirroring it: the server reads env,
// the client only does arithmetic.
//
// The arithmetic itself comes from the same pure functions the payment path uses
// (`allocateUplineOverrides`, `splitRentalPayment`), with `availableShare` always passed EXPLICITLY —
// the imported default is never relied on here, for the reason above.

import * as React from 'react';
import { allocateUplineOverrides } from '@/lib/commerce/uplineChain';
import { splitRentalPayment, type SplitVariant } from '@/lib/commerce/rentalSplits';

export type ScenarioLabProps = {
  /** Resolved server-side from PARTNER_FEE_SHARE — the protected share of the fee. */
  partnerFeeShare: number;
  /** Resolved server-side from QS_FEE_SHARE — the slice ALL overrides share. */
  availableShare: number;
  /** Resolved server-side from MAX_PLATFORM_FEE_PERCENT. */
  maxFeePct: number;
  /** Settled rental manager rates, from SPLIT. */
  rentalManagerStandard: number;
  rentalManagerRecruit: number;
  rentalCloserShare: number;
  /** Who the page is for — used in labels so this reads as theirs, not as a generic tool. */
  personName?: string;
  /** Name for the level between them and the sale. */
  middleName?: string;
  /** Which panels to show. */
  rails?: { commerce?: boolean; rentals?: boolean };
};

const money = (cents: number) =>
  `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const money0 = (cents: number) => `$${Math.round(cents / 100).toLocaleString('en-US')}`;
const pct = (n: number) => `${(n * 100).toFixed((n * 100) % 1 === 0 ? 0 : 1)}%`;

function Slider({
  label,
  value,
  onChange,
  min,
  max,
  step,
  format,
  hint,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  step: number;
  format: (n: number) => string;
  hint?: string;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-zinc-300">{label}</span>
        <span className="font-mono text-sm text-emerald-300">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-emerald-500"
      />
      {hint && <p className="mt-1 text-xs text-zinc-600">{hint}</p>}
    </label>
  );
}

function Out({
  label,
  value,
  tone = 'zinc',
  note,
}: {
  label: string;
  value: string;
  tone?: 'zinc' | 'emerald' | 'rose' | 'amber';
  note?: string;
}) {
  const tones = {
    zinc: 'text-zinc-200',
    emerald: 'text-emerald-300',
    rose: 'text-rose-300',
    amber: 'text-amber-300',
  } as const;
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-zinc-800/60 py-2 last:border-0">
      <span className="text-sm text-zinc-400">
        {label}
        {note && <span className="ml-2 text-xs text-zinc-600">{note}</span>}
      </span>
      <span className={`shrink-0 font-mono text-sm ${tones[tone]}`}>{value}</span>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
      <h3 className="text-base font-semibold text-white">{title}</h3>
      {children}
    </div>
  );
}

export default function ScenarioLab({
  partnerFeeShare,
  availableShare,
  maxFeePct,
  rentalManagerStandard,
  rentalManagerRecruit,
  rentalCloserShare,
  personName = 'you',
  middleName = 'a manager under you',
  rails = { commerce: true, rentals: true },
}: ScenarioLabProps) {
  // ── commerce ──
  const [gmv, setGmv] = React.useState(10_000);
  const [feePct, setFeePct] = React.useState(0.05);
  const [merchants, setMerchants] = React.useState(10);
  const [yourShare, setYourShare] = React.useState(0.05);
  const [middleShare, setMiddleShare] = React.useState(0);

  const feeCents = Math.round(gmv * 100 * feePct);
  const protectedCents = Math.floor(feeCents * partnerFeeShare);
  const sliceCents = Math.round(feeCents * availableShare);

  // Nearest-first: the middle level is closer to the sale, so it is first in the chain.
  const chain = React.useMemo(
    () =>
      [
        ...(middleShare > 0 ? [{ code: 'middle', overrideShare: middleShare }] : []),
        { code: 'you', overrideShare: yourShare },
      ].filter((l) => l.overrideShare > 0),
    [middleShare, yourShare]
  );
  const alloc = allocateUplineOverrides(feeCents, chain, availableShare);
  const paid = new Map(alloc.payments.map((p) => [p.code, p.cents]));
  const yours = paid.get('you') ?? 0;
  const middle = paid.get('middle') ?? 0;
  const houseCents = sliceCents - alloc.totalCents;
  const youShorted = alloc.shorted.some((s) => s.code === 'you');

  // ── rentals ──
  const [rent, setRent] = React.useState(99);
  const [accounts, setAccounts] = React.useState(5);
  const [variant, setVariant] = React.useState<SplitVariant>('recruit');
  const [secondLevel, setSecondLevel] = React.useState(0);

  const r = splitRentalPayment(Math.round(rent * 100), variant);
  const secondCents = Math.floor(r.netCents * secondLevel);
  const rentalHouse = r.houseCents - secondCents;

  return (
    <div className="space-y-4">
      {rails.commerce && (
        <Panel title="Online orders — move the sliders">
          <p className="mt-1 text-sm text-zinc-400">
            Your rate here isn&rsquo;t decided. This is the arithmetic behind whatever we pick.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Slider
              label="A merchant's monthly orders"
              value={gmv}
              onChange={setGmv}
              min={1_000}
              max={50_000}
              step={1_000}
              format={(n) => `$${n.toLocaleString('en-US')}`}
            />
            <Slider
              label="Platform fee on each order"
              value={feePct}
              onChange={setFeePct}
              min={0.01}
              max={maxFeePct}
              step={0.005}
              format={pct}
              hint={`Capped at ${pct(maxFeePct)}`}
            />
            <Slider
              label={`Your share of the fee`}
              value={yourShare}
              onChange={setYourShare}
              min={0}
              max={availableShare}
              step={0.005}
              format={pct}
              hint={`Can't exceed ${pct(availableShare)} — see below`}
            />
            <Slider
              label={`${middleName}'s share`}
              value={middleShare}
              onChange={setMiddleShare}
              min={0}
              max={availableShare}
              step={0.005}
              format={pct}
              hint="Paid before yours, because they're closer to the sale"
            />
            <Slider
              label="Merchants across your people"
              value={merchants}
              onChange={setMerchants}
              min={1}
              max={50}
              step={1}
              format={(n) => `${n}`}
            />
          </div>

          <div className="mt-5 rounded-lg border border-zinc-800 bg-zinc-950/50 p-4">
            <Out label="Platform fee on that merchant" value={money(feeCents)} />
            <Out
              label="Whoever signed them up"
              value={money(protectedCents)}
              note={`${pct(partnerFeeShare)} — protected`}
            />
            <Out
              label="The slice everything else shares"
              value={money(sliceCents)}
              note={pct(availableShare)}
            />
            {middleShare > 0 && <Out label={`${middleName}`} value={money(middle)} />}
            <Out
              label={`${personName === 'you' ? 'You' : personName}, per merchant`}
              value={money(yours)}
              tone={youShorted ? 'rose' : 'emerald'}
              note={youShorted ? 'nothing left for you' : undefined}
            />
            <Out
              label="House"
              value={money(houseCents)}
              tone={houseCents <= 0 ? 'amber' : 'zinc'}
              note={houseCents <= 0 ? 'nothing left to run on' : undefined}
            />
            <Out
              label={`Your total across ${merchants} merchant${merchants === 1 ? '' : 's'}`}
              value={`${money0(yours * merchants)}/mo`}
              tone="emerald"
            />
            <Out label="Same, over a year" value={money0(yours * merchants * 12)} tone="emerald" />
          </div>

          {youShorted && (
            <p className="mt-3 rounded-lg border border-rose-500/25 bg-rose-500/[0.05] p-3 text-sm text-rose-200">
              ⛔ At these rates <strong>you&rsquo;re paid nothing</strong>. The two shares together
              exceed the {pct(availableShare)} slice, and whoever is closest to the sale is paid
              first — so the shortfall lands on you, in full rather than as a reduction. That is
              deliberate: a rate that quietly shrinks is worse than one that visibly doesn&rsquo;t
              fit. Turn either slider down.
            </p>
          )}
          {!youShorted && houseCents <= 0 && (
            <p className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/[0.05] p-3 text-sm text-amber-200">
              ⚠️ This pays out the entire slice and leaves the house nothing on that order. Workable
              on one merchant; not a thing the business can run on.
            </p>
          )}
        </Panel>
      )}

      {rails.rentals && (
        <Panel title="Rentals — your manager override is already settled">
          <p className="mt-1 text-sm text-zinc-400">
            {pct(rentalManagerRecruit)} of net for someone you recruited,{' '}
            {pct(rentalManagerStandard)} otherwise. The second-level slider is the part that{' '}
            <em>isn&rsquo;t</em> built — it&rsquo;s here so the trade is visible.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Slider
              label="Monthly rental price"
              value={rent}
              onChange={setRent}
              min={99}
              max={399}
              step={10}
              format={(n) => `$${n}`}
              hint="$99 today; steps to $399 on page one"
            />
            <Slider
              label="Accounts across your people"
              value={accounts}
              onChange={setAccounts}
              min={1}
              max={40}
              step={1}
              format={(n) => `${n}`}
            />
            <Slider
              label="A second level below you (not built)"
              value={secondLevel}
              onChange={setSecondLevel}
              min={0}
              max={0.2}
              step={0.01}
              format={pct}
              hint="Comes out of the house, never the closer"
            />
            <div>
              <span className="text-sm text-zinc-300">Did you recruit the closer?</span>
              <div className="mt-2 flex gap-2">
                {(['recruit', 'standard'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setVariant(v)}
                    className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                      variant === v
                        ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200'
                        : 'border-zinc-700 text-zinc-400 hover:bg-zinc-800'
                    }`}
                  >
                    {v === 'recruit'
                      ? `Yes — ${pct(rentalManagerRecruit)}`
                      : `No — ${pct(rentalManagerStandard)}`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-lg border border-zinc-800 bg-zinc-950/50 p-4">
            <Out label="Customer pays" value={money(r.grossCents)} />
            <Out label="Stripe" value={`− ${money(r.feeCents)}`} />
            <Out label="Net" value={money(r.netCents)} note="every share comes from this" />
            <Out
              label="Closer"
              value={money(r.closerCents)}
              note={`${pct(rentalCloserShare)} — protected`}
            />
            <Out
              label={`${personName === 'you' ? 'You' : personName} as manager`}
              value={money(r.managerCents)}
              tone="emerald"
              note="settled"
            />
            {secondLevel > 0 && (
              <Out label="A second level" value={money(secondCents)} note="hypothetical" />
            )}
            <Out
              label="House"
              value={money(rentalHouse)}
              tone={rentalHouse <= 0 ? 'rose' : rentalHouse < r.netCents * 0.1 ? 'amber' : 'zinc'}
              note={rentalHouse <= 0 ? 'underwater' : 'buys the domain + ranking work'}
            />
            <Out
              label={`Your total across ${accounts} account${accounts === 1 ? '' : 's'}`}
              value={`${money0(r.managerCents * accounts)}/mo`}
              tone="emerald"
            />
            <Out
              label="Same, over a year"
              value={money0(r.managerCents * accounts * 12)}
              tone="emerald"
            />
          </div>

          {rentalHouse < r.netCents * 0.1 && (
            <p className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/[0.05] p-3 text-sm text-amber-200">
              ⚠️ At this second-level rate the house keeps {money(rentalHouse)} per account — and
              that is what buys the domain and funds getting it to rank. This is the trade, not a
              technicality.
            </p>
          )}
        </Panel>
      )}

      <p className="text-xs text-zinc-600">
        Arithmetic from the same functions that calculate a real payment (
        <code className="text-zinc-500">allocateUplineOverrides</code>,{' '}
        <code className="text-zinc-500">splitRentalPayment</code>). Rates you move here change
        nothing — they&rsquo;re set per referral code, and every one is currently zero.
      </p>
    </div>
  );
}
