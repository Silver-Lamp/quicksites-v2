// app/leads/[token]/page.tsx
//
// A pay-per-call business's own statement (docs/PPL_VERTICAL.md §8 Phase 2): balance, every
// charge with the caller's number, duration and recording, credits, and a "contest this" form
// on any charge still inside the 72-hour window. Reached by a signed link from the statement
// emails — no login, because these owners will not make an account. noindex; never cached.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import SiteHeader from '@/components/site/site-header';
import SiteFooter from '@/components/site/site-footer';
import { verifyStatementToken } from '@/lib/ppl/statementToken';
import { getPplAccount, listLedger } from '@/lib/ppl/accounts';
import { listDisputesForAccount, DISPUTE_CATEGORIES } from '@/lib/ppl/disputes';
import { disputeWindowOpen, usd, PPL_DEFAULTS } from '@/lib/ppl/rules';
import { supabaseAdmin } from '@/lib/supabase/admin';
import DisputeForm from '@/components/leads/dispute-form';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const metadata = { title: 'Lead statement', robots: { index: false, follow: false } };

export default async function LeadStatementPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const v = verifyStatementToken(token);
  if (!v) notFound();
  const account = await getPplAccount(v.accountId);
  if (!account || account.status === 'closed') notFound();

  const [ledger, disputes] = await Promise.all([
    listLedger(account.id, 200),
    listDisputesForAccount(account.id),
  ]);
  const disputeByLedger = new Map(disputes.map((d) => [d.ledger_id, d]));
  const sids = ledger.map((r) => r.call_sid).filter(Boolean) as string[];
  const { data: recs } = sids.length
    ? await supabaseAdmin.from('call_logs').select('call_sid, recording_url').in('call_sid', sids)
    : { data: [] as Array<{ call_sid: string; recording_url: string | null }> };
  const recBySid = new Map((recs ?? []).map((r) => [r.call_sid, r.recording_url]));
  const now = Date.now();

  return (
    <>
      <SiteHeader sticky />
      <main className="min-h-screen bg-background text-foreground">
        <div className="mx-auto max-w-3xl px-6 py-12">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Pay-per-call statement
          </p>
          <h1 className="mt-1 text-2xl font-semibold">{account.business_name}</h1>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-4 text-card-foreground">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Prepaid balance
              </div>
              <div className="mt-1 text-2xl font-bold">{usd(account.balance_cents)}</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-card-foreground">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Per qualified call
              </div>
              <div className="mt-1 text-2xl font-bold">{usd(account.cpl_cents)}</div>
              <div className="text-xs text-muted-foreground">
                answered, {account.min_billable_seconds}s or longer
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-card-foreground">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Status
              </div>
              <div className="mt-1 text-2xl font-bold capitalize">{account.status}</div>
              {account.status === 'paused' ? (
                <div className="text-xs text-muted-foreground">calls are not connecting</div>
              ) : null}
            </div>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Every charge below can be contested for {PPL_DEFAULTS.disputeWindowHours} hours after it
            posts. Listen to the recording first; an approved dispute credits the full amount back.
          </p>

          <h2 className="mt-10 text-lg font-semibold">Activity</h2>
          {ledger.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Nothing yet.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {ledger.map((r) => {
                const isCharge = r.kind === 'lead_charge';
                const dispute = disputeByLedger.get(r.id);
                const canDispute = isCharge && !dispute && disputeWindowOpen(r.created_at, now);
                const rec = r.call_sid ? recBySid.get(r.call_sid) : null;
                return (
                  <li
                    key={r.id}
                    className="rounded-xl border border-border bg-card p-4 text-card-foreground"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div>
                        <div className="text-sm font-medium">
                          {isCharge
                            ? 'Qualified call'
                            : r.kind === 'deposit'
                              ? 'Deposit'
                              : r.kind === 'dispute_credit'
                                ? 'Dispute credit'
                                : 'Adjustment'}
                          {isCharge && r.caller_number ? (
                            <span className="text-muted-foreground"> · from {r.caller_number}</span>
                          ) : null}
                          {isCharge && r.duration_seconds ? (
                            <span className="text-muted-foreground"> · {r.duration_seconds}s</span>
                          ) : null}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(r.created_at).toLocaleString('en-US')}
                          {r.memo ? ` · ${r.memo}` : ''}
                        </div>
                      </div>
                      <div
                        className={`text-base font-semibold tabular-nums ${r.amount_cents < 0 ? '' : 'text-emerald-400'}`}
                      >
                        {r.amount_cents < 0 ? '−' : '+'}
                        {usd(Math.abs(r.amount_cents))}
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          bal {usd(r.balance_after_cents)}
                        </span>
                      </div>
                    </div>
                    {isCharge ? (
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                        {rec ? (
                          <a
                            href={`/api/leads/recording/${encodeURIComponent(r.call_sid!)}?t=${encodeURIComponent(token)}`}
                            className="rounded border border-border px-2 py-1 hover:bg-muted"
                          >
                            ▶ Recording
                          </a>
                        ) : (
                          <span className="text-muted-foreground">recording not available</span>
                        )}
                        {dispute ? (
                          <span
                            className={`rounded-full border px-2 py-0.5 ${dispute.status === 'approved' ? 'border-emerald-500/40 text-emerald-300' : dispute.status === 'denied' ? 'border-border text-muted-foreground' : 'border-amber-500/40 text-amber-300'}`}
                          >
                            dispute {dispute.status} ·{' '}
                            {DISPUTE_CATEGORIES[dispute.category] ?? dispute.category}
                          </span>
                        ) : canDispute ? (
                          <DisputeForm token={token} ledgerId={r.id} />
                        ) : (
                          <span className="text-muted-foreground">dispute window closed</span>
                        )}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-10 text-xs text-muted-foreground">
            Questions about a charge you can no longer contest here? Reply to any statement email.{' '}
            <Link href="/" className="underline">
              QuickSites
            </Link>
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
