// lib/commerce/rentalCommissions.ts
//
// Turns a paid rental invoice into commission_ledger rows, so the rental rail earns its
// money the same way the commerce rail does: accrue at payment, void on refund, pay via
// the existing payout runner. Before this, a rental payment recorded that it happened and
// nothing about who was owed anything — the split was computable and unpayable.
//
// Two subjects are written per payment:
//   rental_closer            — 50% of net, to the rep who closed it
//   rental_manager_override  — 15%, or 25% when that manager RECRUITED the closer
//
// The override is funded out of the house share and never out of the closer's, matching
// clampOverrideShare()'s invariant on the commerce side. When no manager is credited the
// override simply isn't written and the house keeps it — never accrued to nobody.

import { supabaseAdmin } from '@/lib/supabase/admin';
import { splitRentalPayment, type SplitVariant } from '@/lib/commerce/rentalSplits';

export const SUBJECT_CLOSER = 'rental_closer';
export const SUBJECT_MANAGER = 'rental_manager_override';
export const RENTAL_SUBJECTS = [SUBJECT_CLOSER, SUBJECT_MANAGER] as const;

export type RentalCommissionResult = {
  wrote: number;
  skipped: 'no_closer' | 'zero_amount' | null;
  variant: SplitVariant | null;
  closerCents: number;
  managerCents: number;
};

/**
 * Whether `managerCode` recruited `closerCode`, read from referral_codes.parent_code —
 * the single existing record of who recruited whom, already driving the hub override.
 * Deriving it here means the override rate can never depend on which table you read.
 */
export async function managerRecruitedCloser(
  closerCode: string,
  managerCode: string | null
): Promise<boolean> {
  if (!managerCode) return false;
  const { data } = await supabaseAdmin
    .from('referral_codes')
    .select('parent_code')
    .eq('code', closerCode)
    .maybeSingle();
  const parent = (data as any)?.parent_code;
  return !!parent && String(parent).toLowerCase() === managerCode.toLowerCase();
}

/**
 * Accrue commissions for one paid rental invoice.
 *
 * Idempotent on (referral_code, subject, subject_id) via commission_unique_subject, with
 * the Stripe invoice id as subject_id — so a webhook redelivery updates the same rows
 * instead of paying twice. Best-effort by design: a commission that fails to record must
 * never fail the webhook and cause Stripe to retry a payment we already recorded.
 */
export async function recordRentalCommissions(args: {
  campaignId: string;
  invoiceId: string;
  amountPaidCents: number;
  currency?: string | null;
}): Promise<RentalCommissionResult> {
  const empty: RentalCommissionResult = {
    wrote: 0,
    skipped: null,
    variant: null,
    closerCents: 0,
    managerCents: 0,
  };

  if (!args.amountPaidCents || args.amountPaidCents <= 0) {
    return { ...empty, skipped: 'zero_amount' };
  }

  const { data: campaign } = await supabaseAdmin
    .from('geo_industry_campaigns')
    .select('id, domain, sold_by_code, manager_code')
    .eq('id', args.campaignId)
    .maybeSingle();

  const closerCode = (campaign as any)?.sold_by_code as string | null;
  // No closer credited means nobody has been promised anything for this rental. Recording
  // an unattributed accrual would invent a debt with no creditor.
  if (!closerCode) return { ...empty, skipped: 'no_closer' };

  const managerCode = ((campaign as any)?.manager_code as string | null) || null;
  const isRecruit = await managerRecruitedCloser(closerCode, managerCode);
  const variant: SplitVariant = isRecruit ? 'recruit' : 'standard';

  const split = splitRentalPayment(args.amountPaidCents, variant);
  const currency = (args.currency || 'USD').toUpperCase();

  const rows: any[] = [
    {
      referral_code: closerCode,
      subject: SUBJECT_CLOSER,
      subject_id: args.invoiceId,
      amount_cents: split.closerCents,
      currency,
      status: 'pending',
      adjustments: {
        note: 'rental closer commission',
        campaign_id: args.campaignId,
        domain: (campaign as any)?.domain ?? null,
        gross_cents: split.grossCents,
        processor_fee_cents: split.feeCents,
        net_cents: split.netCents,
        share: split.shares.closer,
      },
    },
  ];

  if (managerCode && split.managerCents > 0) {
    rows.push({
      referral_code: managerCode,
      subject: SUBJECT_MANAGER,
      subject_id: args.invoiceId,
      amount_cents: split.managerCents,
      currency,
      status: 'pending',
      adjustments: {
        note: isRecruit ? 'rental override (recruited closer)' : 'rental override',
        campaign_id: args.campaignId,
        domain: (campaign as any)?.domain ?? null,
        closer_code: closerCode,
        recruited: isRecruit,
        net_cents: split.netCents,
        share: split.shares.manager,
      },
    });
  }

  const { error } = await supabaseAdmin
    .from('commission_ledger')
    .upsert(rows, { onConflict: 'referral_code,subject,subject_id' });

  if (error) throw new Error(`recordRentalCommissions failed: ${error.message}`);

  return {
    wrote: rows.length,
    skipped: null,
    variant,
    closerCents: split.closerCents,
    managerCents: managerCode ? split.managerCents : 0,
  };
}

/**
 * Reverse commissions for a refunded rental invoice.
 *
 * Mirrors the order path: anything not yet paid out is voided outright. Rows already PAID
 * are left alone and reported back — money that has left the building cannot be voided by
 * an update, and silently marking it void would erase the fact that it is owed back.
 */
export async function voidRentalCommissions(invoiceId: string): Promise<{
  voided: number;
  alreadyPaid: number;
}> {
  const { data: existing } = await supabaseAdmin
    .from('commission_ledger')
    .select('id, status')
    .in('subject', RENTAL_SUBJECTS as unknown as string[])
    .eq('subject_id', invoiceId);

  const all = (existing ?? []) as { id: string; status: string }[];
  const alreadyPaid = all.filter((r) => r.status === 'paid').length;

  const { data: updated, error } = await supabaseAdmin
    .from('commission_ledger')
    .update({ status: 'void', adjustments: { note: 'voided on rental refund' } })
    .in('subject', RENTAL_SUBJECTS as unknown as string[])
    .eq('subject_id', invoiceId)
    .neq('status', 'paid')
    .select('id');

  if (error) throw new Error(`voidRentalCommissions failed: ${error.message}`);

  return { voided: (updated ?? []).length, alreadyPaid };
}
