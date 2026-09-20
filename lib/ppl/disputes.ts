// lib/ppl/disputes.ts
//
// A business contesting one lead charge, and the operator deciding it. The 72-hour window is
// lib/ppl/rules.ts#disputeWindowOpen; the unique index on ppl_disputes.ledger_id makes a second
// dispute of the same charge impossible at the DB. Approval posts a `dispute_credit` for the
// charge's amount against the same call_sid (the ledger's lead-charge uniqueness does not apply
// to credits), so the balance moves through the one function every cent goes through.

import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  getLedgerRow,
  getPplAccount,
  postLedger,
  type PplAccount,
  type PplLedgerRow,
} from '@/lib/ppl/accounts';
import { disputeWindowOpen } from '@/lib/ppl/rules';
import { sendEmail } from '@/lib/email';
import { usd } from '@/lib/ppl/rules';

export const DISPUTE_CATEGORIES: Record<string, string> = {
  GEO: 'Out of my service area',
  SVC: 'Not a service I offer',
  DUP: 'Same caller, already counted',
  EXC: 'Existing customer, not a new lead',
  SPM: 'Spam, sales call or wrong number',
  DUR: 'We did not actually talk',
  OTHER: 'Something else',
};

export type PplDispute = {
  id: string;
  account_id: string;
  ledger_id: string;
  call_sid: string;
  category: string;
  explanation: string;
  status: 'open' | 'approved' | 'denied';
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
  created_at: string;
};

export type OpenDisputeResult =
  | { ok: true; dispute: PplDispute }
  | {
      ok: false;
      reason:
        | 'not_a_charge'
        | 'wrong_account'
        | 'window_closed'
        | 'already_disputed'
        | 'bad_category';
    };

export async function openDispute(input: {
  account: PplAccount;
  ledgerId: string;
  category: string;
  explanation: string;
  nowMs?: number;
}): Promise<OpenDisputeResult> {
  if (!DISPUTE_CATEGORIES[input.category]) return { ok: false, reason: 'bad_category' };
  const row = await getLedgerRow(input.ledgerId);
  if (!row || row.kind !== 'lead_charge' || !row.call_sid)
    return { ok: false, reason: 'not_a_charge' };
  if (row.account_id !== input.account.id) return { ok: false, reason: 'wrong_account' };
  if (!disputeWindowOpen(row.created_at, input.nowMs ?? Date.now()))
    return { ok: false, reason: 'window_closed' };

  const { data, error } = await supabaseAdmin
    .from('ppl_disputes')
    .insert({
      account_id: input.account.id,
      ledger_id: row.id,
      call_sid: row.call_sid,
      category: input.category,
      explanation: input.explanation.slice(0, 2000),
    })
    .select('*')
    .single();
  if (error) {
    if (`${error.code}` === '23505') return { ok: false, reason: 'already_disputed' };
    throw new Error(`dispute insert failed: ${error.message}`);
  }
  return { ok: true, dispute: data as PplDispute };
}

export async function listOpenDisputes(): Promise<
  Array<
    PplDispute & {
      business_name: string;
      amount_cents: number;
      caller_number: string | null;
      duration_seconds: number | null;
    }
  >
> {
  const { data, error } = await supabaseAdmin
    .from('ppl_disputes')
    .select(
      '*, ppl_accounts!inner(business_name), ppl_ledger!inner(amount_cents, caller_number, duration_seconds)'
    )
    .eq('status', 'open')
    .order('created_at', { ascending: true });
  if (error) throw new Error(`dispute list failed: ${error.message}`);
  return (data ?? []).map((d: any) => ({
    ...d,
    business_name: d.ppl_accounts?.business_name ?? '',
    amount_cents: d.ppl_ledger?.amount_cents ?? 0,
    caller_number: d.ppl_ledger?.caller_number ?? null,
    duration_seconds: d.ppl_ledger?.duration_seconds ?? null,
  }));
}

export async function listDisputesForAccount(accountId: string): Promise<PplDispute[]> {
  const { data, error } = await supabaseAdmin
    .from('ppl_disputes')
    .select('*')
    .eq('account_id', accountId);
  if (error) throw new Error(`dispute list failed: ${error.message}`);
  return (data ?? []) as PplDispute[];
}

/** Operator decision. Approval credits the charge back; both outcomes email the business. */
export async function decideDispute(input: {
  disputeId: string;
  decision: 'approved' | 'denied';
  note?: string;
  actorId: string;
}): Promise<
  | { ok: true; credited: PplLedgerRow | null }
  | { ok: false; reason: 'not_found' | 'already_decided' }
> {
  const { data: d } = await supabaseAdmin
    .from('ppl_disputes')
    .select('*')
    .eq('id', input.disputeId)
    .maybeSingle();
  if (!d) return { ok: false, reason: 'not_found' };
  if (d.status !== 'open') return { ok: false, reason: 'already_decided' };
  const charge = await getLedgerRow(d.ledger_id);
  const account = await getPplAccount(d.account_id);
  if (!charge || !account) return { ok: false, reason: 'not_found' };

  let credited: PplLedgerRow | null = null;
  if (input.decision === 'approved') {
    credited = await postLedger({
      account_id: account.id,
      kind: 'dispute_credit',
      amount_cents: -charge.amount_cents,
      call_sid: charge.call_sid,
      memo: `Dispute approved (${d.category})${input.note ? `: ${input.note}` : ''}`,
      created_by: input.actorId,
    });
  }
  await supabaseAdmin
    .from('ppl_disputes')
    .update({
      status: input.decision,
      decided_by: input.actorId,
      decided_at: new Date().toISOString(),
      decision_note: input.note ?? null,
    })
    .eq('id', d.id);

  if (account.contact_email) {
    const label = DISPUTE_CATEGORIES[d.category] ?? d.category;
    const approved = input.decision === 'approved';
    await sendEmail({
      to: account.contact_email,
      subject: approved
        ? `Credit applied: ${usd(-charge.amount_cents)} back on ${account.business_name}'s lead balance`
        : `Dispute reviewed: the ${usd(-charge.amount_cents)} lead charge stands`,
      html: `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:600px;margin:0 auto;color:#1f2937">
  <h2 style="font-size:18px">${approved ? 'Your dispute was approved' : 'Your dispute was reviewed'}</h2>
  <p>Call on ${new Date(charge.created_at).toLocaleString('en-US')}${charge.caller_number ? ` from ${charge.caller_number}` : ''}${charge.duration_seconds ? `, ${charge.duration_seconds}s` : ''}. Reason given: ${label}.</p>
  <p>${approved ? `We credited ${usd(-charge.amount_cents)} back to your balance${credited ? ` (now ${usd(credited.balance_after_cents)})` : ''}.` : `After listening to the recording, the call meets the qualified-lead terms (answered, ${account.min_billable_seconds}s or longer), so the charge stands.`}${input.note ? ` Note: ${input.note}` : ''}</p>
  <p style="font-size:12px;color:#6b7280">You can review any charge and its recording on your statement page at any time.</p>
</div>`,
    }).catch(() => {});
  }
  return { ok: true, credited };
}
