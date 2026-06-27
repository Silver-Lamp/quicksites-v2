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
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
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

async function attemptStripeTransfer(
  db: any,
  partnerUserId: string,
  amountCents: number,
  currency: string
): Promise<{ method: string; txRef: string }> {
  try {
    const { data: pa } = await db
      .from('partner_payout_accounts')
      .select('account_ref, status')
      .eq('user_id', partnerUserId)
      .eq('provider', 'stripe')
      .maybeSingle();
    if (process.env.STRIPE_SECRET_KEY && pa?.account_ref && pa.status === 'active') {
      const transfer = await stripe.transfers.create({
        amount: amountCents,
        currency: currency.toLowerCase(),
        destination: pa.account_ref,
      });
      return { method: 'stripe', txRef: transfer.id };
    }
  } catch {
    // fall through to a manual record (partner not connected / Stripe unconfigured)
  }
  return { method: 'other', txRef: `manual_${Date.now()}` };
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
  let totalCents = 0;

  for (const [owner, g] of byOwner) {
    totalCents += g.amountCents;
    if (opts.dryRun) {
      partners.push({ affiliateUserId: owner, amountCents: g.amountCents, codes: [...g.codes] });
      continue;
    }
    const { method, txRef } = await attemptStripeTransfer(db, owner, g.amountCents, g.currency);
    const { data: payout } = await db
      .from('affiliate_payouts')
      .insert({
        affiliate_user_id: owner,
        paid_at: new Date().toISOString(),
        amount_cents: g.amountCents,
        currency: g.currency,
        method,
        tx_ref: txRef,
        is_tpso: method === 'stripe',
      })
      .select('id')
      .single();
    await db.from('commission_ledger').update({ status: 'paid' }).in('id', g.rowIds);
    partners.push({ affiliateUserId: owner, amountCents: g.amountCents, codes: [...g.codes], method, txRef, payoutId: payout?.id });
  }

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
        total_approved_cents_before: totalCents,
        total_marked_paid_cents: totalCents,
        count_codes: codes.length,
        count_rows_marked: approved.length,
        meta: { partners: partners.length },
      })
      .select('id')
      .single();

    if (run?.id) {
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
        rows_marked: it.rows,
        marked_paid_cents: it.approved,
      }));
      if (items.length) await db.from('payout_run_items').insert(items);
    }
  }

  return { dryRun: !!opts.dryRun, totalCents, partners };
}
