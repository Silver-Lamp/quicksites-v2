// app/admin/ppl/page.tsx
//
// The pay-per-call machine on one screen (docs/PPL_VERTICAL.md): gates, the §10 sequence with
// live status, the numbers the tables hold, every account and every tracked campaign, the open
// tasks, and the links a person needs next. Admin-gated, server-rendered, nothing cached —
// every figure is re-derived on load so this page can never remember a stale number.

import Link from 'next/link';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { assemblePplOps, type PplStep } from '@/lib/ppl/ops';
import { usd } from '@/lib/ppl/rules';
import PplAccountActions from '@/components/admin/ppl-account-actions';
import PplAttachNumberForm from '@/components/admin/ppl-attach-number-form';
import { listTrackingNumbers, twilioConfigured } from '@/lib/outreach/callTracking';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const STEP_TONE: Record<PplStep['status'], string> = {
  done: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  ready: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
  waiting: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  blocked: 'border-border bg-muted text-muted-foreground',
};
const STEP_LABEL: Record<PplStep['status'], string> = {
  done: 'done',
  ready: 'do now',
  waiting: 'waiting',
  blocked: 'blocked',
};
const WHO: Record<PplStep['who'], string> = { owner: 'Sandon', session: 'session', clock: 'time' };

function Stat({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note?: string;
  tone?: 'good' | 'warn';
}) {
  const ring =
    tone === 'good'
      ? 'border-emerald-500/30'
      : tone === 'warn'
        ? 'border-amber-500/30'
        : 'border-border';
  return (
    <div className={`rounded-xl border ${ring} bg-card p-4 text-card-foreground`}>
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold tracking-tight">{value}</div>
      {note ? <div className="mt-1 text-xs text-muted-foreground">{note}</div> : null}
    </div>
  );
}

function ago(iso: string | null) {
  if (!iso) return '—';
  const d = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  return d === 0 ? 'today' : d === 1 ? '1 day ago' : `${d} days ago`;
}

export default async function PplOpsPage() {
  const admin = await getAdminUser();
  if (!admin) return <div className="p-8 text-muted-foreground">Forbidden.</div>;
  const s = await assemblePplOps();
  // Twilio's own view, read from the running process (the creds are write-only in Vercel, so
  // this page is the only place a person can see what Twilio holds without the console).
  const twilioNumbers = twilioConfigured() ? await listTrackingNumbers().catch(() => []) : [];
  const { data: allCampaigns } = await supabaseAdmin
    .from('geo_industry_campaigns')
    .select('id, domain, forward_to, tracking_number')
    .order('domain');
  const gateTone = (st: string | undefined) =>
    st === 'ready' ? 'good' : st === 'off' ? undefined : 'warn';

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 text-foreground">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Vertical · pay-per-call
          </p>
          <h1 className="mt-1 text-2xl font-semibold">The machine</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            A ranked geo site’s tracking number, forwarded free to a real local business, logged,
            and — once that business says yes — billed per qualified call from a prepaid balance.
            Every number below is read from a table right now.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <Link
            href="/status"
            className="rounded-md border border-border px-2.5 py-1.5 hover:bg-muted"
          >
            /status
          </Link>
          <Link
            href="/admin/tasks"
            className="rounded-md border border-border px-2.5 py-1.5 hover:bg-muted"
          >
            Tasks
          </Link>
          <Link
            href="/admin/call-logs"
            className="rounded-md border border-border px-2.5 py-1.5 hover:bg-muted"
          >
            Call logs
          </Link>
          <Link
            href="/admin/growth?tab=prospects"
            className="rounded-md border border-border px-2.5 py-1.5 hover:bg-muted"
          >
            Growth
          </Link>
          <Link
            href="/business-plan?v=ppl"
            className="rounded-md border border-border px-2.5 py-1.5 hover:bg-muted"
          >
            Business plan
          </Link>
          <a
            href="https://github.com/Silver-Lamp/quicksites-v2/blob/main/docs/PPL_VERTICAL.md"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-border px-2.5 py-1.5 hover:bg-muted"
          >
            Plan (docs)
          </a>
          <a
            href="https://console.twilio.com"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-border px-2.5 py-1.5 hover:bg-muted"
          >
            Twilio ↗
          </a>
          <a
            href="https://dashboard.stripe.com/payments"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-border px-2.5 py-1.5 hover:bg-muted"
          >
            Stripe ↗
          </a>
        </div>
      </div>

      {/* Gates + flags */}
      <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Twilio (sms gate)"
          value={s.gates.sms?.status ?? 'n/a'}
          tone={gateTone(s.gates.sms?.status)}
          note="creds in production"
        />
        <Stat
          label="PPL billing gate"
          value={s.gates.ppl?.status ?? 'n/a'}
          tone={gateTone(s.gates.ppl?.status)}
          note={s.flags.ppl ? 'PPL_ENABLED on' : 'PPL_ENABLED off — nothing is charged'}
        />
        <Stat
          label="Call tracking flag"
          value={s.flags.callTracking ? 'on' : 'off'}
          tone={s.flags.callTracking ? 'good' : undefined}
          note="CALL_TRACKING_ENABLED — buys numbers"
        />
        <Stat
          label="Geo webhook (deposits)"
          value={s.gates.geo_rentals?.status ?? 'n/a'}
          tone={gateTone(s.gates.geo_rentals?.status)}
          note="deposits ride this endpoint"
        />
      </section>

      {/* Measured */}
      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Campaigns with a number"
          value={`${s.stats.campaignsWithNumber} / ${s.stats.campaigns}`}
          note={`${s.stats.campaignsPageOne} on page one`}
          tone={s.stats.campaignsWithNumber ? 'good' : 'warn'}
        />
        <Stat
          label="Calls, 30 days"
          value={String(s.stats.calls30d)}
          note={`${s.stats.qualified30d} qualified (≥ 90 s, answered)`}
        />
        <Stat
          label="Accounts"
          value={String(s.stats.accounts)}
          note={`${s.stats.accountsActive} active · ${s.stats.accountsPaused} paused`}
        />
        <Stat label="Prepaid balance held" value={usd(s.stats.balanceTotalCents)} />
        <Stat
          label="Lead charges, 30 days"
          value={String(s.stats.leadCharges30d)}
          tone={s.stats.leadCharges30d ? 'good' : undefined}
        />
        <Stat
          label="Revenue, 30 days"
          value={usd(s.stats.revenue30dCents)}
          note={`− ${usd(s.stats.disputeCredits30dCents)} dispute credits`}
        />
        <Stat
          label="Open disputes"
          value={String(s.stats.disputesOpen)}
          tone={s.stats.disputesOpen ? 'warn' : undefined}
        />
        <Stat
          label="Snapshot"
          value={new Date(s.generatedAt).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
          })}
          note="re-derived on every load"
        />
      </section>

      {/* The sequence */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold">The sequence</h2>
        <p className="text-sm text-muted-foreground">
          docs/PPL_VERTICAL.md §10, with status derived from the tables. A step is “do now” only
          when everything above it is done.
        </p>
        <ol className="mt-4 space-y-2">
          {s.steps.map((st) => (
            <li
              key={st.n}
              className="flex flex-wrap items-start gap-3 rounded-xl border border-border bg-card p-3 text-card-foreground"
            >
              <span
                className={`mt-0.5 inline-flex min-w-[64px] justify-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${STEP_TONE[st.status]}`}
              >
                {STEP_LABEL[st.status]}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">
                  {st.n}. {st.title}{' '}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    · {WHO[st.who]}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">{st.detail}</div>
              </div>
              {st.href ? (
                <Link href={st.href} className="text-xs text-sky-400 hover:text-sky-300">
                  open →
                </Link>
              ) : null}
            </li>
          ))}
        </ol>
      </section>

      {/* Accounts */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold">Accounts</h2>
        {s.accounts.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            None yet. Open the first with{' '}
            <code className="rounded bg-muted px-1">POST /api/admin/ppl/accounts</code> once a
            campaign has a tracking number and a business has said yes.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Business</th>
                  <th className="px-3 py-2">Site</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Balance</th>
                  <th className="px-3 py-2 text-right">Lead price</th>
                  <th className="px-3 py-2 text-right">Leads 30d</th>
                  <th className="px-3 py-2">Last charge</th>
                  <th className="px-3 py-2">Card</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {s.accounts.map((a) => (
                  <tr key={a.id} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">{a.business_name}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {a.domain ?? a.geo_campaign_id.slice(0, 8)}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] ${a.status === 'active' ? 'border-emerald-500/40 text-emerald-300' : a.status === 'paused' ? 'border-amber-500/40 text-amber-300' : 'border-border text-muted-foreground'}`}
                      >
                        {a.status}
                        {a.paused_reason ? ` · ${a.paused_reason}` : ''}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{usd(a.balance_cents)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{usd(a.cpl_cents)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{a.leads_30d}</td>
                    <td className="px-3 py-2 text-muted-foreground">{ago(a.last_charge_at)}</td>
                    <td className="px-3 py-2">
                      {a.stripe_payment_method_id ? (
                        <span className="text-emerald-300">saved</span>
                      ) : (
                        <span className="text-amber-300">none</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <PplAccountActions id={a.id} status={a.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Tracked campaigns */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold">Tracked campaigns</h2>
        <p className="text-sm text-muted-foreground">
          Every campaign with a tracking number, a ppl pricing model, or an account. The forward-to
          is free until an account exists; PPL only ever dials the account holder.
        </p>
        {s.campaigns.length === 0 ? (
          <p className="mt-2 text-sm text-amber-300">
            No campaign has a tracking number. Step 1 is the Grafton attach.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Domain</th>
                  <th className="px-3 py-2">Rank</th>
                  <th className="px-3 py-2">Number</th>
                  <th className="px-3 py-2">Forwards to</th>
                  <th className="px-3 py-2 text-right">Calls 30d</th>
                  <th className="px-3 py-2 text-right">Qualified</th>
                  <th className="px-3 py-2">Last call</th>
                  <th className="px-3 py-2">Account</th>
                </tr>
              </thead>
              <tbody>
                {s.campaigns.map((c) => (
                  <tr key={c.id} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">
                      <a
                        href={`https://${c.domain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline"
                      >
                        {c.domain}
                      </a>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{c.rank_status ?? '—'}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {c.tracking_number ?? <span className="text-amber-300">none</span>}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-muted-foreground">
                      {c.forward_to ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{c.calls_30d}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{c.qualified_30d}</td>
                    <td className="px-3 py-2 text-muted-foreground">{ago(c.last_call_at)}</td>
                    <td className="px-3 py-2">
                      {c.account ? (
                        `${c.account.business_name} · ${c.account.status} · ${usd(c.account.balance_cents)}`
                      ) : (
                        <span className="text-muted-foreground">free forward</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Twilio inventory + attach */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold">Twilio numbers</h2>
        <p className="text-sm text-muted-foreground">
          What the account holds and where each number points, read live. A number bound to a Studio
          flow shows the flow SID; attaching it below moves it to our voice route (the flow stays as
          a fallback), sets the SMS webhook for STOP, and writes the number to the campaign.
        </p>
        {!twilioConfigured() ? (
          <p className="mt-2 text-sm text-amber-300">
            Twilio is not configured in this environment.
          </p>
        ) : twilioNumbers.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No numbers on the account (or the list failed).
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Number</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Account</th>
                  <th className="px-3 py-2">Voice</th>
                  <th className="px-3 py-2">SMS</th>
                  <th className="px-3 py-2">Campaign</th>
                </tr>
              </thead>
              <tbody>
                {twilioNumbers.map((n) => {
                  const c = (allCampaigns ?? []).find((x) => x.tracking_number === n.phoneNumber);
                  return (
                    <tr key={n.sid} className="border-t border-border">
                      <td className="px-3 py-2 tabular-nums">{n.phoneNumber}</td>
                      <td className="px-3 py-2 text-muted-foreground">{n.friendlyName ?? '—'}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {n.inSubaccount ? (
                          <span className="text-amber-300">
                            subaccount {n.accountName ?? n.accountSid.slice(0, 10)} — attach moves
                            it to the parent
                          </span>
                        ) : (
                          'parent'
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {n.voiceApplicationSid
                          ? `flow ${n.voiceApplicationSid}`
                          : (n.voiceUrl ?? '—')}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{n.smsUrl ?? '—'}</td>
                      <td className="px-3 py-2">
                        {c ? c.domain : <span className="text-amber-300">unattached</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <h3 className="mt-5 text-base font-semibold">Attach a number to a campaign</h3>
        <PplAttachNumberForm
          campaigns={
            (allCampaigns ?? []) as Array<{
              id: string;
              domain: string;
              forward_to: string | null;
              tracking_number: string | null;
            }>
          }
          numbers={twilioNumbers.map((n) => n.phoneNumber)}
        />
      </section>

      {/* Open tasks */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold">Open PPL tasks</h2>
        {s.tasks.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">None open.</p>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {s.tasks.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span
                  className={`rounded-full border px-2 py-0.5 text-[11px] ${t.status === 'blocked' ? 'border-border text-muted-foreground' : 'border-sky-500/40 text-sky-300'}`}
                >
                  {t.status}
                </span>
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {t.category === 'owner-action' ? 'Sandon' : 'session'} · {t.priority}
                </span>
                <Link href={`/admin/tasks?id=${t.id}`} className="hover:underline">
                  {t.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* How to */}
      <section className="mt-10 rounded-xl border border-border bg-card p-4 text-sm text-card-foreground">
        <h2 className="text-base font-semibold">Operator commands</h2>
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          <li>
            <code className="rounded bg-muted px-1">POST /api/admin/ppl/accounts</code>{' '}
            {'{ geo_campaign_id, business_name, contact_email, contact_phone, deposit_cents }'} →
            account + deposit link
          </li>
          <li>
            <code className="rounded bg-muted px-1">GET /api/admin/ppl/accounts/&lt;id&gt;</code> →
            account + ledger + Stripe portal URL
          </li>
          <li>
            <code className="rounded bg-muted px-1">PATCH /api/admin/ppl/accounts/&lt;id&gt;</code>{' '}
            {'{ credit: { call_sid, memo } }'} → approve a dispute (one lead credited)
          </li>
          <li>
            <code className="rounded bg-muted px-1">
              POST /api/admin/prospects/geo-campaign/provision-number
            </code>{' '}
            {'{ campaignId, forwardTo }'} → buy a local number (needs CALL_TRACKING_ENABLED)
          </li>
        </ul>
      </section>
    </div>
  );
}
