// lib/ppl/accounts.ts
//
// Data access for pay-per-call accounts and their ledger. Service role (deny-default RLS), so
// every caller is a signed webhook or an admin-gated route — route auth is load-bearing (§6).

import { supabaseAdmin } from '@/lib/supabase/admin';
import type { PplAccountLike } from '@/lib/ppl/rules';

export type PplAccount = PplAccountLike & {
  id: string;
  geo_campaign_id: string;
  business_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  stripe_customer_id: string | null;
  stripe_payment_method_id: string | null;
  paused_reason: string | null;
  paused_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PplLedgerRow = {
  id: string;
  account_id: string;
  kind: 'deposit' | 'lead_charge' | 'dispute_credit' | 'adjustment';
  amount_cents: number;
  balance_after_cents: number;
  call_sid: string | null;
  caller_number: string | null;
  duration_seconds: number | null;
  stripe_payment_intent_id: string | null;
  memo: string | null;
  created_by: string | null;
  created_at: string;
};

const COLS =
  'id, geo_campaign_id, business_name, contact_email, contact_phone, stripe_customer_id, stripe_payment_method_id, cpl_cents, min_billable_seconds, reload_threshold_cents, reload_amount_cents, auto_reload, balance_cents, status, paused_reason, paused_at, created_at, updated_at';

export async function getPplAccountByCampaign(campaignId: string): Promise<PplAccount | null> {
  const { data, error } = await supabaseAdmin
    .from('ppl_accounts')
    .select(COLS)
    .eq('geo_campaign_id', campaignId)
    .maybeSingle();
  if (error) throw new Error(`ppl account lookup failed: ${error.message}`);
  return (data as PplAccount | null) ?? null;
}

export async function getPplAccount(id: string): Promise<PplAccount | null> {
  const { data, error } = await supabaseAdmin
    .from('ppl_accounts')
    .select(COLS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`ppl account lookup failed: ${error.message}`);
  return (data as PplAccount | null) ?? null;
}

export async function getPplAccountByStripeCustomer(
  customerId: string
): Promise<PplAccount | null> {
  const { data, error } = await supabaseAdmin
    .from('ppl_accounts')
    .select(COLS)
    .eq('stripe_customer_id', customerId)
    .maybeSingle();
  if (error) throw new Error(`ppl account lookup failed: ${error.message}`);
  return (data as PplAccount | null) ?? null;
}

export async function listPplAccounts(): Promise<PplAccount[]> {
  const { data, error } = await supabaseAdmin
    .from('ppl_accounts')
    .select(COLS)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`ppl account list failed: ${error.message}`);
  return (data as PplAccount[]) ?? [];
}

export async function createPplAccount(input: {
  geo_campaign_id: string;
  business_name: string;
  contact_email?: string | null;
  contact_phone?: string | null;
  cpl_cents?: number;
  min_billable_seconds?: number;
  reload_threshold_cents?: number;
  reload_amount_cents?: number;
  auto_reload?: boolean;
}): Promise<PplAccount> {
  const { data, error } = await supabaseAdmin
    .from('ppl_accounts')
    .insert({ ...input, status: 'pending' })
    .select(COLS)
    .single();
  if (error) throw new Error(`ppl account create failed: ${error.message}`);
  return data as PplAccount;
}

export async function updatePplAccount(
  id: string,
  patch: Partial<
    Pick<
      PplAccount,
      | 'status'
      | 'paused_reason'
      | 'paused_at'
      | 'stripe_customer_id'
      | 'stripe_payment_method_id'
      | 'contact_email'
      | 'contact_phone'
      | 'auto_reload'
      | 'cpl_cents'
      | 'reload_threshold_cents'
      | 'reload_amount_cents'
      | 'min_billable_seconds'
    >
  >
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('ppl_accounts')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(`ppl account update failed: ${error.message}`);
}

/**
 * Post a ledger row through the DB function (row-locked, balance moved atomically). Returns
 * null when the DB's unique indexes say it was already posted — the caller must treat that as
 * "done earlier", not as a failure, because Twilio and Stripe both retry.
 */
export async function postLedger(input: {
  account_id: string;
  kind: PplLedgerRow['kind'];
  amount_cents: number;
  call_sid?: string | null;
  caller_number?: string | null;
  duration_seconds?: number | null;
  stripe_payment_intent_id?: string | null;
  memo?: string | null;
  created_by?: string | null;
}): Promise<PplLedgerRow | null> {
  const { data, error } = await supabaseAdmin.rpc('ppl_post_ledger', {
    p_account_id: input.account_id,
    p_kind: input.kind,
    p_amount_cents: input.amount_cents,
    p_call_sid: input.call_sid ?? null,
    p_caller_number: input.caller_number ?? null,
    p_duration_seconds: input.duration_seconds ?? null,
    p_stripe_payment_intent_id: input.stripe_payment_intent_id ?? null,
    p_memo: input.memo ?? null,
    p_created_by: input.created_by ?? null,
  });
  if (error) throw new Error(`ppl ledger post failed: ${error.message}`);
  // A RETURNS <composite> function yields the row, or a row of nulls when it returned NULL.
  const row = data as PplLedgerRow | null;
  return row && row.id ? row : null;
}

export async function listLedger(accountId: string, limit = 100): Promise<PplLedgerRow[]> {
  const { data, error } = await supabaseAdmin
    .from('ppl_ledger')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`ppl ledger list failed: ${error.message}`);
  return (data as PplLedgerRow[]) ?? [];
}

export async function getLedgerRow(id: string): Promise<PplLedgerRow | null> {
  const { data, error } = await supabaseAdmin
    .from('ppl_ledger')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`ppl ledger lookup failed: ${error.message}`);
  return (data as PplLedgerRow | null) ?? null;
}
