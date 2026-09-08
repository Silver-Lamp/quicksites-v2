// components/business-plan/operator-panel.tsx
//
// The ONLY part of the business plan that is hidden from a reader.
//
// ⚠️ The rule that makes this safe: nothing unflattering may live in here. The plan is
// shareable precisely because its weak half is not behind a login — hiding "0 rented" or an
// unproven column while showing the revenue would turn an honest document into a pitch, and
// the reader could not tell. So this panel carries OPERATIONAL detail only: per-rental
// payment counts, links into admin surfaces they cannot open anyway, and the note about
// where the prose is maintained.
//
// Pinned by app/business-plan/__tests__/planHonesty.test.ts, which asserts the plan body
// gates exactly one thing (this) and that this file names nothing from the unproven column.
import Link from 'next/link';
import type { PlanEvidence } from '@/lib/business/planEvidence';
import type { TradeOpsSnapshot } from '@/lib/tradeSites/opsSnapshot';
import { formatCents } from '@/lib/commerce/rentalSplits';

function Flag({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
        on ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-neutral-700 bg-neutral-900 text-neutral-500'
      }`}
    >
      {label} {on ? 'on' : 'off'}
    </span>
  );
}

function when(iso: string | null): string {
  if (!iso) return 'never';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? 'never' : d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' }) + ' PT';
}

/** The trade-site pipeline as it stands right now: queue, last run, what is waiting to mail. */
function TradePipelineOps({ ops }: { ops: TradeOpsSnapshot }) {
  const blockedTotal = Object.values(ops.mail.blocked).reduce((a, b) => a + b, 0);
  return (
    <div className="mt-6 rounded-lg border border-neutral-800 bg-neutral-950/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-white">Trade-site pipeline, right now</h3>
        <div className="flex flex-wrap gap-1.5">
          <Flag on={ops.flags.pipeline} label="cron" />
          <Flag on={ops.flags.mail && ops.flags.postcardMail && ops.flags.lob} label="postcards" />
          <Flag on={ops.flags.billing} label="domain checkout" />
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat k="Queued sweeps" v={String(ops.queue.queued)} s={`${ops.caps.maxSweeps} a night · ${ops.queue.done} done · ${ops.queue.failed} failed`} />
        <Stat
          k="Last run"
          v={ops.lastRun ? `${ops.lastRun.built} built` : 'never'}
          s={ops.lastRun ? `${when(ops.lastRun.finishedAt)} · ${ops.lastRun.sweeps} sweep${ops.lastRun.sweeps === 1 ? '' : 's'}, ${ops.lastRun.noWebsiteFound} no-website found` : 'the cron has not run yet'}
        />
        <Stat
          k="Waiting to mail"
          v={String(ops.mail.mailable)}
          s={`${ops.caps.maxMail} a night after ${ops.caps.minAgeHours}h${blockedTotal ? ` · ${blockedTotal} blocked (${Object.entries(ops.mail.blocked).map(([k, n]) => `${n} ${k.replace(/_/g, ' ')}`).join(', ')})` : ''}`}
        />
        <Stat
          k="Last mailed"
          v={ops.lastRun ? String(ops.lastRun.mailed) : '—'}
          s={ops.lastRun?.mailReason ? `step: ${ops.lastRun.mailReason.replace(/_/g, ' ')}` : ops.lastRun ? 'cards sent in the last run' : ''}
        />
      </div>

      {(ops.queue.next.length > 0 || ops.queue.recent.length > 0) && (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">Up next</div>
            {ops.queue.next.length ? (
              <ol className="mt-1 space-y-1 text-sm text-neutral-300">
                {ops.queue.next.map((r, i) => (
                  <li key={r.id}>
                    <span className="mr-2 text-neutral-600">{i + 1}.</span>
                    {r.city}, {r.region} · {r.category}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-1 text-sm text-neutral-500">Nothing queued — plan the queue on /admin/growth.</p>
            )}
          </div>
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">Recent sweeps</div>
            {ops.queue.recent.length ? (
              <ul className="mt-1 space-y-1 text-sm text-neutral-300">
                {ops.queue.recent.map((r) => {
                  const res = (r.result ?? {}) as { found?: number; tallies?: { no_website?: number } };
                  return (
                    <li key={r.id}>
                      {r.city}, {r.region} · {r.category} —{' '}
                      {r.status === 'failed' ? <span className="text-rose-300">failed{r.error ? `: ${r.error}` : ''}</span> : <span className="text-neutral-400">{res.tallies?.no_website ?? 0} no-website of {res.found ?? 0}</span>}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-neutral-500">No sweep has finished yet.</p>
            )}
          </div>
        </div>
      )}

      <p className="mt-3 text-xs text-neutral-500">
        Queue, preview cards and mail:{' '}
        <Link href="/admin/growth?tab=prospects" className="text-sky-400 underline underline-offset-4">/admin/growth</Link>
        . Read the last run's <em>built</em> and <em>mailed</em>, not its status — a run that processes nothing still says ok.
      </p>
    </div>
  );
}

function Stat({ k, v, s }: { k: string; v: string; s?: string }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-950/50 p-4">
      <div className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">{k}</div>
      <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-white">{v}</div>
      {s && <div className="mt-1 text-xs leading-relaxed text-neutral-500">{s}</div>}
    </div>
  );
}

export default function OperatorPanel({ evidence: e, tradeOps = null }: { evidence: PlanEvidence; tradeOps?: TradeOpsSnapshot | null }) {
  return (
    <section className="mt-12 rounded-xl border border-sky-500/30 bg-sky-500/[0.05] p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold text-white">Operator view</h2>
        <span className="rounded-full border border-sky-500/40 bg-sky-500/10 px-2.5 py-1 text-[11px] font-medium text-sky-300">
          Only you can see this
        </span>
      </div>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-400">
        Working detail, not a weaker version of the story above — everything a reader would need
        to judge this business is on the public half of the page.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat k="Domains held" v={String(e.geoCampaigns)} s="Exact-match, city × trade" />
        <Stat k="Subscriptions" v={String(e.geoRented)} s="Ever created, including tests" />
        <Stat
          k="Rental payments"
          v={String(e.rentalPaymentsTaken)}
          s={`${formatCents(e.rentalCentsCollected)} collected`}
        />
        <Stat
          k="Paid orders"
          v={String(e.paidOrders)}
          s={`${formatCents(e.orderGrossCents)} gross · ${formatCents(e.platformFeeCents)} fee`}
        />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat k="Commission rows" v={String(e.commissionRows)} s="Ledger entries accrued" />
        <Stat k="Catalog items" v={String(e.catalogItems)} s="Across every merchant" />
        <Stat k="Print orders" v={String(e.printOrders)} s="POD fulfilment jobs" />
        <Stat k="Organizations" v={String(e.orgs)} s={`${e.geoPublished} geo sites published`} />
      </div>

      {tradeOps && <TradePipelineOps ops={tradeOps} />}

      <p className="mt-5 text-xs leading-relaxed text-neutral-500">
        Per-rental splits and payouts:{' '}
        <Link href="/admin/splits" className="text-sky-400 underline underline-offset-4">
          /admin/splits
        </Link>{' '}
        · rep brief:{' '}
        <Link href="/for-sales" className="text-sky-400 underline underline-offset-4">
          /for-sales
        </Link>
        . The prose describing what is built and what is not is maintained by hand in{' '}
        <code className="rounded bg-neutral-800 px-1 py-0.5">lib/business/verticals.ts</code> — if
        a line on this page stops being true, fix it there in the same change that made it untrue.
      </p>
    </section>
  );
}
