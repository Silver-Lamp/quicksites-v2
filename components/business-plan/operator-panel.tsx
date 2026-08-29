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
import { formatCents } from '@/lib/commerce/rentalSplits';

function Stat({ k, v, s }: { k: string; v: string; s?: string }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-950/50 p-4">
      <div className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">{k}</div>
      <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-white">{v}</div>
      {s && <div className="mt-1 text-xs leading-relaxed text-neutral-500">{s}</div>}
    </div>
  );
}

export default function OperatorPanel({ evidence: e }: { evidence: PlanEvidence }) {
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
