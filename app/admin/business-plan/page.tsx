// app/admin/business-plan/page.tsx
// The business plan as a live surface: one monetization vertical at a time, with every
// number read from the database at render rather than typed in.
//
// Admin-gated in the page itself — app/admin/layout.tsx only checks "logged in and not a
// guest", and this carries revenue figures and unbuilt strategy.
//
// ⚠️ Written to be shown to a partner or an investor, which is exactly why the unproven
// column is as prominent as the built one. A plan that hides its weak half does not survive
// the first hour of diligence, and the person reading it cannot check the numbers themselves.
import Link from 'next/link';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import {
  VERTICALS,
  STAGE_LABEL,
  getVertical,
  loadPlanEvidence,
  type Stage,
} from '@/lib/business/verticals';
import { formatCents } from '@/lib/commerce/rentalSplits';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const STAGE_TONE: Record<Stage, string> = {
  proven: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  'live-untested': 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  'built-inert': 'border-sky-500/40 bg-sky-500/10 text-sky-300',
  planned: 'border-neutral-600 bg-neutral-800/60 text-neutral-400',
};

function Metric({ k, v, s }: { k: string; v: string; s?: string }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
      <div className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">{k}</div>
      <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-white">{v}</div>
      {s && <div className="mt-1 text-xs leading-relaxed text-neutral-500">{s}</div>}
    </div>
  );
}

export default async function BusinessPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ v?: string }>;
}) {
  const admin = await getAdminUser();
  if (!admin) return <div className="p-8 text-neutral-400">Forbidden.</div>;

  const { v } = await searchParams;
  const vertical = getVertical(v);
  const e = await loadPlanEvidence();

  const lifetimeRevenueCents = e.platformFeeCents + e.rentalCentsCollected;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 text-neutral-200">
      <header className="border-b border-neutral-800 pb-6">
        <div className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">
          Point Seven Studio LLC · Business plan
        </div>
        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            How QuickSites makes money
          </h1>
          <Link
            href="/admin/business-plan/deck"
            className="rounded-md border border-sky-500/50 bg-sky-500/10 px-3 py-1.5 text-sm font-medium text-sky-300 transition-colors hover:border-sky-400 hover:text-sky-200"
          >
            ▶ Present
          </Link>
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-400">
          One site builder and one money path, sold six different ways. Each line below shares the
          same checkout, ledger and payout machinery — which is why a new vertical costs a pitch
          rather than a platform. Every figure on this page is read from the live database when the
          page loads.
        </p>
      </header>

      {/* ── The honest position, first, not buried ─────────────── */}
      <section className="mt-8">
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/[0.07] p-5">
          <h2 className="text-sm font-semibold text-amber-300">Where this actually stands</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-neutral-300">
            Lifetime platform revenue is{' '}
            <span className="font-mono font-semibold text-white">
              {formatCents(lifetimeRevenueCents)}
            </span>
            . The machinery is built and has been proven with real money — live cards, real charges,
            recurring billing that renews unattended and records itself. What has not been proven is
            that anyone wants it. Those are different claims and this page keeps them apart.
          </p>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-neutral-300">
            The reason to read on is not the revenue. It is that six routes to market share one set
            of rails, so the cost of testing the next one is a conversation, not a build.
          </p>
        </div>
      </section>

      {/* ── Company-wide evidence ──────────────────────────────── */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold text-white">What exists today</h2>
        <p className="mt-1 max-w-2xl text-sm text-neutral-400">
          Counted at render. Nothing here is an estimate.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            k="Sites built"
            v={e.templates.toLocaleString()}
            s={`${e.templatesPublished} published`}
          />
          <Metric k="Geo domains" v={String(e.geoCampaigns)} s={`${e.geoRented} rented`} />
          <Metric
            k="Merchants"
            v={String(e.merchants)}
            s={`${e.connectedMerchants} payment-ready`}
          />
          <Metric
            k="Lifetime revenue"
            v={formatCents(lifetimeRevenueCents)}
            s={`${formatCents(e.platformFeeCents)} order fees · ${formatCents(e.rentalCentsCollected)} rent`}
          />
        </div>
      </section>

      {/* ── Vertical picker ────────────────────────────────────── */}
      <section className="mt-12">
        <h2 className="text-lg font-semibold text-white">The six lines</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {VERTICALS.map((x) => {
            const on = x.key === vertical.key;
            return (
              <Link
                key={x.key}
                href={`/admin/business-plan?v=${x.key}`}
                className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  on
                    ? 'border-sky-500/60 bg-sky-500/15 text-sky-200'
                    : 'border-neutral-700 bg-neutral-900/60 text-neutral-400 hover:border-neutral-500 hover:text-neutral-200'
                }`}
              >
                {x.name}
              </Link>
            );
          })}
        </div>

        <article className="mt-6 rounded-xl border border-neutral-800 bg-neutral-900/40 p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h3 className="text-xl font-bold text-white">{vertical.name}</h3>
            <span
              className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${STAGE_TONE[vertical.stage]}`}
            >
              {STAGE_LABEL[vertical.stage]}
            </span>
          </div>
          <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-neutral-300">
            {vertical.oneLiner}
          </p>

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div>
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                How the money works
              </h4>
              <ul className="mt-2 space-y-2">
                {vertical.mechanics.map((m) => (
                  <li key={m} className="text-sm leading-relaxed text-neutral-300">
                    <span className="mr-2 text-neutral-600">—</span>
                    {m}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400">
                Built and working
              </h4>
              <ul className="mt-2 space-y-2">
                {vertical.built.map((b) => (
                  <li key={b} className="text-sm leading-relaxed text-neutral-300">
                    <span className="mr-2 text-emerald-500">✓</span>
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-6 rounded-lg border border-rose-500/30 bg-rose-500/[0.06] p-4">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-rose-300">
              Not proven
            </h4>
            <ul className="mt-2 space-y-2">
              {vertical.unproven.map((u) => (
                <li key={u} className="text-sm leading-relaxed text-neutral-300">
                  <span className="mr-2 text-rose-400">·</span>
                  {u}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-neutral-800 bg-neutral-950/40 p-4">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                What would settle it
              </h4>
              <p className="mt-2 text-sm leading-relaxed text-neutral-300">
                {vertical.decisiveTest}
              </p>
            </div>
            <div className="rounded-lg border border-neutral-800 bg-neutral-950/40 p-4">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                What that costs
              </h4>
              <p className="mt-2 text-sm leading-relaxed text-neutral-300">{vertical.costToTest}</p>
            </div>
          </div>

          {vertical.key === 'rental' && (
            <div className="mt-5 border-t border-neutral-800 pt-4">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                Live rental numbers
              </h4>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <Metric k="Domains held" v={String(e.geoCampaigns)} s="Exact-match, city × trade" />
                <Metric k="Rented" v={String(e.geoRented)} s="Subscriptions ever created" />
                <Metric
                  k="Payments taken"
                  v={String(e.rentalPaymentsTaken)}
                  s={`${formatCents(e.rentalCentsCollected)} collected`}
                />
              </div>
              <p className="mt-3 text-xs leading-relaxed text-neutral-500">
                Splits and per-rental payouts:{' '}
                <Link href="/admin/splits" className="text-sky-400 underline underline-offset-4">
                  /admin/splits
                </Link>
              </p>
            </div>
          )}
        </article>
      </section>

      <p className="mt-10 border-t border-neutral-800 pt-5 text-xs leading-relaxed text-neutral-500">
        Every count on this page is queried when the page loads, so it cannot drift from reality the
        way a written figure does. Prose describing what is built and what is not is maintained by
        hand in{' '}
        <code className="rounded bg-neutral-800 px-1 py-0.5">lib/business/verticals.ts</code> — if a
        line here stops being true, fix it there in the same change that made it untrue.
      </p>
    </div>
  );
}
