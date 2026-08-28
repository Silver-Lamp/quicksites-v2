// app/admin/splits/page.tsx
// Commission splits on geo-domain rentals: the settled policy, and what each person is
// owed on live rentals right now. Admin-gated — this shows what real people are paid, and
// app/admin/layout.tsx only checks "logged in and not a guest", so the gate must be here.
import Link from 'next/link';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { getRentalLedger } from '@/lib/commerce/rentalLedger';
import {
  SPLIT,
  RESIDUAL_TAIL_MONTHS,
  CLAWBACK_WINDOW_DAYS,
  splitRentalPayment,
  splitOnGrossForComparison,
  feeNote,
  formatCents,
} from '@/lib/commerce/rentalSplits';
import AssignRep from '@/components/admin/splits/assign-rep';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const pct = (n: number) => `${Math.round(n * 100)}%`;

function Stat({
  label,
  value,
  sub,
  tone = 'default',
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'default' | 'closer' | 'manager' | 'house' | 'warn';
}) {
  const accent = {
    default: 'text-neutral-100',
    closer: 'text-emerald-400',
    manager: 'text-amber-400',
    house: 'text-sky-400',
    warn: 'text-rose-400',
  }[tone];
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
      <div className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">
        {label}
      </div>
      <div className={`mt-1 font-mono text-2xl font-semibold tabular-nums ${accent}`}>{value}</div>
      {sub && <div className="mt-1 text-xs leading-relaxed text-neutral-500">{sub}</div>}
    </div>
  );
}

export default async function SplitsPage() {
  const admin = await getAdminUser();
  if (!admin) return <div className="p-8 text-neutral-400">Forbidden.</div>;

  const { rows, totals, byPerson } = await getRentalLedger();

  // Worked example for the policy section — the tier the business actually runs on.
  const founder = splitRentalPayment(9900, 'standard');
  const founderRecruit = splitRentalPayment(9900, 'recruit');
  const ranked = splitRentalPayment(39900, 'standard');
  const napkin = splitOnGrossForComparison(9900, 'standard');

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 text-neutral-200">
      <header className="border-b border-neutral-800 pb-6">
        <div className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">
          Point Seven Studio LLC · Geo-domain rentals
        </div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
          Rental commission splits
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-400">
          Every rental payment divides{' '}
          <span className="font-mono text-emerald-400">{pct(SPLIT.closer)}</span> to the closer,{' '}
          <span className="font-mono text-amber-400">{pct(SPLIT.managerStandard)}</span> to their
          manager and the rest to the house — taken from what actually lands after Stripe, not from
          the sticker price.
        </p>
      </header>

      {/* ── What is owed right now ─────────────────────────────── */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold text-white">Owed on live rentals</h2>
        <p className="mt-1 max-w-2xl text-sm text-neutral-400">
          Monthly-equivalent, so a rental billing daily is comparable to one billing monthly. Counts
          every subscription that is still collecting.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Landing monthly"
            value={formatCents(totals.netMonthlyCents)}
            sub={`${formatCents(totals.grossMonthlyCents)} charged, ${formatCents(totals.feeMonthlyCents)} to Stripe`}
          />
          <Stat
            label="Closers"
            value={formatCents(totals.closerMonthlyCents)}
            tone="closer"
            sub="50% of net"
          />
          <Stat
            label="Managers"
            value={formatCents(totals.managerMonthlyCents)}
            tone="manager"
            sub="Override, where one is credited"
          />
          <Stat
            label="Point Seven"
            value={formatCents(totals.houseMonthlyCents)}
            tone="house"
            sub="Remainder, incl. uncredited overrides"
          />
        </div>

        {totals.unassignedMonthlyCents > 0 && (
          <div className="mt-4 rounded-lg border border-rose-500/40 bg-rose-500/10 p-4 text-sm">
            <div className="font-semibold text-rose-300">
              {formatCents(totals.unassignedMonthlyCents)}/mo of net has nobody credited
            </div>
            <p className="mt-1 max-w-2xl leading-relaxed text-neutral-300">
              The split is computable but not payable — assign a closer below. Until then that money
              is reported against the house, which is the safe direction to be wrong in but not a
              record of who earned it.
            </p>
          </div>
        )}

        {byPerson.length > 0 && (
          <div className="mt-6 overflow-x-auto rounded-lg border border-neutral-800">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="bg-neutral-900/60 text-[11px] uppercase tracking-wider text-neutral-500">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">Person</th>
                  <th className="px-4 py-2.5 text-right font-medium">As closer</th>
                  <th className="px-4 py-2.5 text-right font-medium">As manager</th>
                  <th className="px-4 py-2.5 text-right font-medium">Monthly total</th>
                </tr>
              </thead>
              <tbody>
                {byPerson.map((p) => (
                  <tr key={p.name} className="border-t border-neutral-800">
                    <td className="px-4 py-2.5 font-medium text-white">{p.name}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-emerald-400">
                      {formatCents(p.asCloser)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-amber-400">
                      {formatCents(p.asManager)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold tabular-nums text-white">
                      {formatCents(p.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Per-rental ─────────────────────────────────────────── */}
      <section className="mt-12">
        <h2 className="text-lg font-semibold text-white">Every rental with a subscription</h2>
        {rows.length === 0 ? (
          <p className="mt-3 rounded-lg border border-neutral-800 bg-neutral-900/40 p-5 text-sm text-neutral-400">
            No rental has a subscription yet. One appears here the moment a checkout completes and
            the geo webhook records it.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-lg border border-neutral-800">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-neutral-900/60 text-[11px] uppercase tracking-wider text-neutral-500">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">Domain</th>
                  <th className="px-4 py-2.5 text-left font-medium">Status</th>
                  <th className="px-4 py-2.5 text-right font-medium">Charge</th>
                  <th className="px-4 py-2.5 text-right font-medium">Net /mo</th>
                  <th className="px-4 py-2.5 text-right font-medium">Closer</th>
                  <th className="px-4 py-2.5 text-right font-medium">Manager</th>
                  <th className="px-4 py-2.5 text-right font-medium">House</th>
                  <th className="px-4 py-2.5 text-left font-medium">Credited to</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-neutral-800 align-top">
                    <td className="px-4 py-3">
                      <div className="font-mono text-[13px] text-white">{r.domain}</div>
                      <div className="mt-0.5 text-xs text-neutral-500">
                        {r.city} · {r.payment_count} paid
                        {r.last_payment_at
                          ? ` · last ${new Date(r.last_payment_at).toLocaleDateString()}`
                          : ''}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                          r.subscription_status === 'active'
                            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                            : r.subscription_status === 'past_due'
                              ? 'border-rose-500/40 bg-rose-500/10 text-rose-300'
                              : 'border-neutral-700 bg-neutral-800/60 text-neutral-400'
                        }`}
                      >
                        {r.subscription_status}
                      </span>
                      {r.payment_count === 0 && (
                        <div className="mt-1 text-[11px] text-amber-400">never billed</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-neutral-300">
                      {formatCents(r.chargeCents)}
                      <span className="text-neutral-600">/{r.billing_interval ?? 'mo'}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-neutral-300">
                      {formatCents(r.split.netCents)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-emerald-400">
                      {formatCents(r.split.closerCents)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-amber-400">
                      {r.manager_code ? formatCents(r.split.managerCents) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-sky-400">
                      {formatCents(
                        r.manager_code
                          ? r.split.houseCents
                          : r.split.houseCents + r.split.managerCents
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <AssignRep
                        campaignId={r.id}
                        domain={r.domain}
                        soldByCode={r.sold_by_code}
                        soldByLabel={r.sold_by_label}
                        managerCode={r.manager_code}
                        managerLabel={r.manager_label}
                        recruited={r.managerRecruitedCloser}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Policy ─────────────────────────────────────────────── */}
      <section className="mt-12">
        <h2 className="text-lg font-semibold text-white">The rule</h2>
        <p className="mt-1 max-w-2xl text-sm text-neutral-400">
          Settled 25 August 2026. Written as percentages because the same rule holds at any price —
          the original dollar version summed to $100 on a $99 sale.
        </p>

        <div className="mt-4 overflow-x-auto rounded-lg border border-neutral-800">
          <table className="w-full min-w-[620px] text-sm">
            <thead className="bg-neutral-900/60 text-[11px] uppercase tracking-wider text-neutral-500">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Scenario</th>
                <th className="px-4 py-2.5 text-right font-medium">Charged</th>
                <th className="px-4 py-2.5 text-right font-medium">Stripe</th>
                <th className="px-4 py-2.5 text-right font-medium">Closer</th>
                <th className="px-4 py-2.5 text-right font-medium">Manager</th>
                <th className="px-4 py-2.5 text-right font-medium">Point Seven</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Founder $99 — standard', founder],
                ['Founder $99 — manager recruited the closer', founderRecruit],
                ['Ranked $399 — standard', ranked],
              ].map(([label, s]: any) => (
                <tr key={label} className="border-t border-neutral-800">
                  <td className="px-4 py-2.5 text-neutral-300">{label}</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-neutral-400">
                    {formatCents(s.grossCents)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-rose-400">
                    −{formatCents(s.feeCents)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-emerald-400">
                    {formatCents(s.closerCents)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-amber-400">
                    {formatCents(s.managerCents)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-sky-400">
                    {formatCents(s.houseCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-neutral-500">{feeNote()}</p>

        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {[
            {
              n: '01',
              h: 'Shares come off the net',
              p: `On a $99 sale the reps are paid from ${formatCents(founder.netCents)}, not $99. Under the original dollar rule the house alone absorbed the processor and kept ${formatCents(napkin.houseCents)} instead of ${formatCents(founder.houseCents)} — and would absorb every future rate rise on every lifetime account.`,
            },
            {
              n: '02',
              h: 'A manager selling alone is just the closer',
              p: 'They take the 50% and no override. The override is payment for building a team; on a solo sale there is no team member, and the house keeps the rest.',
            },
            {
              n: '03',
              h: `Residuals run while active, then ${RESIDUAL_TAIL_MONTHS} months`,
              p: `A rep keeps their share for as long as the rental pays and they are engaged, then a ${RESIDUAL_TAIL_MONTHS}-month tail after they leave, then it stops. Long enough to be worth selling hard for; bounded, so a departed rep does not become permanent overhead.`,
            },
            {
              n: '04',
              h: 'Earned when the payment sticks',
              p: `A refund or chargeback inside ${CLAWBACK_WINDOW_DAYS} days reverses that month's commission out of the next payout. Nobody objects to this before they have been paid, which is why it is written down now.`,
            },
            {
              n: '05',
              h: 'Plan on $99; treat $399 as upside',
              p: 'The ranked rate needs a domain on page one and none are there yet. If the founder column does not work on its own, the business does not work — no amount of $399 arriving later repairs a plan that required it.',
            },
            {
              n: '06',
              h: 'The recruit raise is funded by the house',
              p: `When a manager recruited the closer their override rises ${pct(SPLIT.managerStandard)} → ${pct(SPLIT.managerRecruit)}, entirely out of the house share. The closer's 50% is never touched, so recruiting never competes with selling.`,
            },
          ].map((d) => (
            <div key={d.n} className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
              <div className="flex items-baseline gap-2.5">
                <span className="font-mono text-[11px] text-neutral-600">{d.n}</span>
                <h3 className="text-sm font-semibold text-white">{d.h}</h3>
              </div>
              <p className="mt-1.5 pl-[26px] text-sm leading-relaxed text-neutral-400">{d.p}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Honest limits ──────────────────────────────────────── */}
      <section className="mt-12">
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/[0.07] p-5">
          <h2 className="text-sm font-semibold text-amber-300">
            Accrual is automatic; paying is not
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-neutral-300">
            Every paid rental invoice now writes{' '}
            <code className="rounded bg-neutral-800 px-1 py-0.5">commission_ledger</code> rows — a
            closer row and, where a manager is credited, an override row — keyed on the Stripe
            invoice so a webhook redelivery cannot pay anyone twice. A refund voids anything not yet
            paid out. These are the same rows the existing payout runner already pays from.
          </p>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-neutral-300">
            What is still manual is the paying. Accruals sit as{' '}
            <span className="font-mono text-amber-300">pending</span> until a payout run approves
            and sends them, and a rep with no Stripe connection has their balance held rather than
            transferred. A rental with nobody credited accrues <em>nothing</em> — the split is shown
            above but no debt is recorded, because a commission owed to no one is not a commission.
          </p>
          <p className="mt-3 text-xs text-neutral-500">
            Related:{' '}
            <Link href="/admin/revenue" className="text-sky-400 underline underline-offset-4">
              platform revenue
            </Link>{' '}
            ·{' '}
            <Link
              href="/admin/growth?tab=prospects"
              className="text-sky-400 underline underline-offset-4"
            >
              rentals &amp; campaigns
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
