// app/admin/analytics/page.tsx
//
// "What analytics do we run, what does each one record, and is it actually collecting right now?"
// Everything on this page is derived: the diagram and the table from lib/analytics/stack.ts, the
// status from this running process, the funnel from the EVENTS constants. Nothing is typed twice.
//
// Admin-only — it names env keys (presence only) and links the vendor consoles.
import Link from 'next/link';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { describeAnalyticsStack, AUTOMATION_LABEL } from '@/lib/analytics/stack';
import { EVENTS } from '@/lib/analytics/events';
import AnalyticsFlow from '@/components/admin/analytics-flow';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const GH = 'https://github.com/Silver-Lamp/quicksites-v2/blob/main/';

/** The Model A money funnel, in order, from the header of lib/analytics/events.ts. */
const FUNNEL = [
  EVENTS.SIGNUP,
  EVENTS.BUILDER_ACTIVATED,
  EVENTS.SITE_PUBLISHED,
  EVENTS.MERCHANT_CONNECTED,
  EVENTS.CATALOG_ITEM_CREATED,
  EVENTS.ORDER_CREATED,
  EVENTS.ORDER_PAID,
  EVENTS.PLATFORM_FEE_COLLECTED,
] as const;

export default async function AdminAnalyticsPage() {
  const admin = await getAdminUser();
  if (!admin) {
    return <div className="mx-auto max-w-3xl px-6 py-10 text-sm text-red-500">Admin access required.</div>;
  }

  const statuses = describeAnalyticsStack();
  const configured = statuses.filter((s) => s.status === 'configured').length;
  const eventNames = Object.values(EVENTS);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 text-foreground">
      <h1 className="text-2xl font-bold">Analytics</h1>
      <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
        Four collectors, two vendors, one rule: automation is never counted as a customer. This page
        is drawn from{' '}
        <Link href={`${GH}lib/analytics/stack.ts`} className="text-sky-400 underline underline-offset-4">
          lib/analytics/stack.ts
        </Link>
        , and a test fails the build if an analytics call site is added without declaring it there.
      </p>

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full border border-border bg-muted px-2.5 py-1 text-muted-foreground">
          {configured} of {statuses.length} sending
        </span>
        <span className="rounded-full border border-border bg-muted px-2.5 py-1 text-muted-foreground">
          {eventNames.length} named events
        </span>
        <span className="rounded-full border border-border bg-muted px-2.5 py-1 text-muted-foreground">
          {FUNNEL.length}-step money funnel
        </span>
      </div>

      <AnalyticsFlow statuses={statuses} />

      {/* ---- the table ---- */}
      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        What each one records
      </h2>
      <div className="mt-3 space-y-3">
        {statuses.map(({ system, status, envPresent, envMissing }) => (
          <div key={system.id} className="rounded-lg border border-border bg-card p-4 text-card-foreground">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-base font-semibold">
                {system.label}{' '}
                <span className="text-xs font-normal text-muted-foreground">
                  {system.side === 'server' ? 'server-side' : 'browser'}
                </span>
              </h3>
              <span
                className={`rounded-full border px-2.5 py-0.5 text-[11px] ${
                  status === 'configured'
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                    : 'border-border bg-muted text-muted-foreground'
                }`}
              >
                {status === 'configured' ? 'sending' : 'not configured'}
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{system.records}</p>

            <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-xs sm:grid-cols-3">
              <div>
                <dt className="text-muted-foreground">Automation</dt>
                <dd className="mt-0.5">{AUTOMATION_LABEL[system.automation]}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Lands in</dt>
                <dd className="mt-0.5">
                  <a href={system.consoleUrl} target="_blank" rel="noreferrer" className="text-sky-400 underline underline-offset-4">
                    {system.destination}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Env</dt>
                <dd className="mt-0.5">
                  {system.envKeys.length === 0 ? (
                    <span className="text-muted-foreground">nothing to configure</span>
                  ) : (
                    <>
                      {envPresent.map((k) => (
                        <code key={k} className="mr-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-emerald-300">
                          {k} ✓
                        </code>
                      ))}
                      {envMissing.map((k) => (
                        <code key={k} className="mr-1 rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                          {k} —
                        </code>
                      ))}
                    </>
                  )}
                </dd>
              </div>
            </dl>

            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs">
              {system.sources.map((p) => (
                <a key={p} href={`${GH}${p}`} target="_blank" rel="noreferrer" className="text-sky-400 underline underline-offset-4">
                  {p}
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ---- the funnel ---- */}
      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        The money funnel
      </h2>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        Server-side, in order. Each step fires at the database transition it names, so a step cannot
        be inflated by a page view. Build the funnel insight in PostHog from these exact names.
      </p>
      <ol className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        {FUNNEL.map((e, i) => (
          <li key={e} className="flex items-center gap-2">
            <code className="rounded border border-border bg-muted px-2 py-1">{e}</code>
            {i < FUNNEL.length - 1 && <span className="text-muted-foreground">→</span>}
          </li>
        ))}
      </ol>

      <details className="mt-4 rounded-lg border border-border bg-card p-4">
        <summary className="cursor-pointer text-sm font-medium">
          All {eventNames.length} named events
        </summary>
        <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
          {eventNames.map((e) => (
            <code key={e} className="rounded border border-border bg-muted px-1.5 py-0.5 text-muted-foreground">
              {e}
            </code>
          ))}
        </div>
      </details>

      <p className="mt-6 text-xs text-muted-foreground">
        ⚠️ “Sending” means this deploy is emitting events. Neither vendor tells us whether it
        ingested them — for that, open the console links above. Web Analytics also needs its toggle
        enabled in the Vercel project settings, which no code here can set.
      </p>
    </div>
  );
}
