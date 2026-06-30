// lib/commerce/payouts.ts
//
// Partner payout pipeline (completes the money loop):
//   1) approveCommissions — pending → approved once past the refund window
//   2) runPayouts — group approved commissions by partner, transfer their residual
//      (real Stripe Connect transfer when configured, else a 'manual' record),
//      write affiliate_payouts, mark the commissions paid, and audit a payout_run.
import { createClient } from '@supabase/supabase-js';
import { stripe } from '@/lib/stripe/server';
import { REFUND_WINDOW_DAYS } from './partner-terms';

// `any` client: the trimmed types/supabase.ts omits the commerce tables, so the
// typed client resolves them to `never`. The rest of lib/commerce does the same.
function admin(): any {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!, {
    auth: { persistSession: false },
  });
}

/** Move 'pending' commissions to 'approved' once older than the refund window. */
export async function approveCommissions(refundWindowDays = REFUND_WINDOW_DAYS): Promise<number> {
  const db = admin();
  const cutoff = new Date(Date.now() - refundWindowDays * 86400_000).toISOString();
  const { data, error } = await db
    .from('commission_ledger')
    .update({ status: 'approved' })
    .eq('status', 'pending')
    .lt('created_at', cutoff)
    .select('id');
  if (error) throw error;
  return data?.length ?? 0;
}

// Discriminated outcome so the caller can tell an intentional manual payout
// (partner not connected) apart from a real transfer FAILURE — the old code
// collapsed both into a 'manual' record, hiding Stripe errors.
type TransferOutcome =
  | { kind: 'stripe'; txRef: string }
  | { kind: 'manual'; txRef: string }
  | { kind: 'error'; error: string };

async function attemptStripeTransfer(
  db: any,
  partnerUserId: string,
  amountCents: number,
  currency: string,
  idempotencyKey: string
): Promise<TransferOutcome> {
  let pa: any = null;
  try {
    const r = await db
      .from('partner_payout_accounts')
      .select('account_ref, status')
      .eq('user_id', partnerUserId)
      .eq('provider', 'stripe')
      .maybeSingle();
    pa = r.data;
  } catch {
    // treat as not-connected below
  }

  const connected = !!process.env.STRIPE_SECRET_KEY && pa?.account_ref && pa.status === 'active';
  if (!connected) {
    // Not a failure: partner isn't Stripe-connected (or Stripe unconfigured) →
    // record a manual payout for offline processing.
    return { kind: 'manual', txRef: `manual_${idempotencyKey}` };
  }

  try {
    const transfer = await stripe.transfers.create(
      { amount: amountCents, currency: currency.toLowerCase(), destination: pa.account_ref },
      // Idempotency key keyed to the payout row → a retry can't double-send.
      { idempotencyKey: `payout_${idempotencyKey}` }
    );
    return { kind: 'stripe', txRef: transfer.id };
  } catch (e: any) {
    return { kind: 'error', error: String(e?.message || e).slice(0, 500) };
  }
}

export type PayoutResult = {
  dryRun: boolean;
  totalCents: number;
  partners: Array<{
    affiliateUserId: string;
    amountCents: number;
    codes: string[];
    method?: string;
    txRef?: string;
    payoutId?: string;
  }>;
  /** Partners whose transfer was attempted but failed; their commissions were
   * reverted to 'approved' for retry. Empty on a fully clean run. */
  failures?: Array<{ affiliateUserId: string; amountCents: number; error: string }>;
};

/** Pay out all currently-approved commissions, grouped per partner. */
export async function runPayouts(opts: {
  actorUserId: string;
  actorEmail?: string;
  dryRun?: boolean;
}): Promise<PayoutResult> {
  const db = admin();
  const { data: approved, error } = await db
    .from('commission_ledger')
    .select('id, referral_code, amount_cents, currency')
    .eq('status', 'approved');
  if (error) throw error;
  if (!approved?.length) return { dryRun: !!opts.dryRun, totalCents: 0, partners: [] };

  const codes = Array.from(new Set(approved.map((a: any) => a.referral_code as string)));
  const { data: codeRows } = await db.from('referral_codes').select('code, owner_id').in('code', codes);
  const ownerByCode = new Map<string, string>(
    (codeRows ?? []).map((r: any) => [r.code as string, r.owner_id as string] as [string, string])
  );

  type G = { amountCents: number; currency: string; rowIds: string[]; codes: Set<string> };
  const byOwner = new Map<string, G>();
  for (const a of approved as any[]) {
    const owner = ownerByCode.get(a.referral_code);
    if (!owner) continue; // orphan code (no owner) — skip
    const g: G = byOwner.get(owner) ?? { amountCents: 0, currency: a.currency || 'USD', rowIds: [], codes: new Set<string>() };
    g.amountCents += a.amount_cents;
    g.rowIds.push(a.id);
    g.codes.add(a.referral_code);
    byOwner.set(owner, g);
  }

  const partners: PayoutResult['partners'] = [];
  const failures: NonNullable<PayoutResult['failures']> = [];
  let totalAttempted = 0;
  let totalPaid = 0;
  let rowsMarkedPaid = 0;

  for (const [owner, g] of byOwner) {
    totalAttempted += g.amountCents;
    if (opts.dryRun) {
      partners.push({ affiliateUserId: owner, amountCents: g.amountCents, codes: [...g.codes] });
      continue;
    }

    // 1) Record the payout row BEFORE moving money (status 'processing'). If this
    //    fails, no transfer is attempted — nothing to orphan.
    const { data: payout, error: insErr } = await db
      .from('affiliate_payouts')
      .insert({
        affiliate_user_id: owner,
        paid_at: new Date().toISOString(),
        amount_cents: g.amountCents,
        currency: g.currency,
        method: 'other', // tentative; finalized after the transfer outcome
        is_tpso: false,
        status: 'processing',
      })
      .select('id')
      .single();
    if (insErr || !payout?.id) {
      failures.push({ affiliateUserId: owner, amountCents: g.amountCents, error: insErr?.message || 'payout insert failed' });
      continue;
    }
    const payoutId = payout.id as string;

    // 2) Atomically CLAIM the approved commissions for this payout. The
    //    .eq('status','approved') filter means a concurrent/retried run can't
    //    re-claim already-paid rows — this is the double-pay guard.
    const { data: claimed } = await db
      .from('commission_ledger')
      .update({ status: 'paid', payout_id: payoutId })
      .in('id', g.rowIds)
      .eq('status', 'approved')
      .select('id, amount_cents');
    const claimedRows = (claimed ?? []) as Array<{ id: string; amount_cents: number }>;
    const claimedAmount = claimedRows.reduce((s, r) => s + (r.amount_cents || 0), 0);

    if (claimedAmount <= 0) {
      // Nothing actually claimed (already paid elsewhere) — void the empty payout.
      await db.from('affiliate_payouts').update({ status: 'cancelled', amount_cents: 0 }).eq('id', payoutId);
      continue;
    }
    if (claimedAmount !== g.amountCents) {
      await db.from('affiliate_payouts').update({ amount_cents: claimedAmount }).eq('id', payoutId);
    }

    // 3) Move the money (idempotency keyed to payoutId), then finalize the row.
    const outcome = await attemptStripeTransfer(db, owner, claimedAmount, g.currency, payoutId);
    if (outcome.kind === 'error') {
      // Transfer failed → revert the claim so it retries next run, mark failed.
      await db
        .from('commission_ledger')
        .update({ status: 'approved', payout_id: null })
        .in('id', claimedRows.map((r) => r.id));
      await db.from('affiliate_payouts').update({ status: 'failed', error: outcome.error }).eq('id', payoutId);
      failures.push({ affiliateUserId: owner, amountCents: claimedAmount, error: outcome.error });
      continue;
    }

    const method = outcome.kind === 'stripe' ? 'stripe' : 'other';
    await db
      .from('affiliate_payouts')
      .update({ status: 'paid', method, tx_ref: outcome.txRef, is_tpso: outcome.kind === 'stripe' })
      .eq('id', payoutId);
    totalPaid += claimedAmount;
    rowsMarkedPaid += claimedRows.length;
    partners.push({ affiliateUserId: owner, amountCents: claimedAmount, codes: [...g.codes], method, txRef: outcome.txRef, payoutId });
  }

  const totalCents = opts.dryRun ? totalAttempted : totalPaid;

  // Audit the run
  if (!opts.dryRun && partners.length) {
    const today = new Date().toISOString().slice(0, 10);
    const { data: run } = await db
      .from('payout_runs')
      .insert({
        actor_user_id: opts.actorUserId,
        actor_email: opts.actorEmail ?? null,
        range_start: today,
        range_end: today,
        codes,
        total_approved_cents_before: totalAttempted,
        total_marked_paid_cents: totalPaid,
        count_codes: codes.length,
        count_rows_marked: rowsMarkedPaid,
        meta: { partners: partners.length, failures: failures.length },
      })
      .select('id')
      .single();

    if (run?.id) {
      // Only codes belonging to a successfully-paid partner count as paid.
      const paidCodes = new Set<string>(partners.flatMap((p) => p.codes));
      const itemsByCode = new Map<string, { approved: number; rows: number }>();
      for (const a of approved) {
        const it = itemsByCode.get(a.referral_code) ?? { approved: 0, rows: 0 };
        it.approved += a.amount_cents;
        it.rows += 1;
        itemsByCode.set(a.referral_code, it);
      }
      const items = [...itemsByCode].map(([code, it]) => ({
        payout_run_id: run.id,
        referral_code: code,
        approved_cents_before: it.approved,
        rows_marked: paidCodes.has(code) ? it.rows : 0,
        marked_paid_cents: paidCodes.has(code) ? it.approved : 0,
      }));
      if (items.length) await db.from('payout_run_items').insert(items);
    }
  }

  return { dryRun: !!opts.dryRun, totalCents, partners, failures };
}
