// lib/agreements/store.ts
//
// Reads and writes for agreements. Service-role throughout: both tables are deny-default RLS and
// the signer is unauthenticated by design, so authorisation lives in the caller (a verified
// signing token, or an operator session) — which makes it load-bearing rather than incidental.
//
// ⚠️ THE SCOPING RULE. Every function takes the agreement id FIRST, and that id must come from a
// verified token or an ownership check, never from a request body. Same rule as lib/collab.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { documentHash } from './document';

export type Agreement = {
  id: string;
  title: string;
  body_md: string;
  party_name: string;
  party_email: string | null;
  signer_name: string;
  signer_email: string;
  status: string;
  voided_at: string | null;
  voided_reason: string | null;
  created_at: string;
};

export type AgreementSignature = {
  id: string;
  agreement_id: string;
  document_sha256: string;
  typed_name: string;
  consented_electronic: boolean;
  signed_at: string;
  signer_ip: string | null;
  user_agent: string | null;
};

function db(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function getAgreement(agreementId: string): Promise<Agreement | null> {
  const s = db();
  if (!s) return null;
  const { data } = await s.from('agreements').select('*').eq('id', agreementId).maybeSingle();
  return (data as Agreement) ?? null;
}

export async function getSignature(agreementId: string): Promise<AgreementSignature | null> {
  const s = db();
  if (!s) return null;
  const { data } = await s
    .from('agreement_signatures')
    .select('*')
    .eq('agreement_id', agreementId)
    .maybeSingle();
  return (data as AgreementSignature) ?? null;
}

export type SignInput = {
  typedName: string;
  consentedElectronic: boolean;
  signerIp?: string | null;
  userAgent?: string | null;
};

export type SignResult =
  | { ok: true; signature: AgreementSignature; agreement: Agreement }
  | { ok: false; reason: 'not_found' | 'voided' | 'already_signed' | 'no_consent' | 'no_name' | 'error' };

/**
 * Record a signature.
 *
 * ⚠️ THE HASH IS COMPUTED HERE, FROM THE STORED DOCUMENT — NEVER ACCEPTED FROM THE CLIENT. A
 * caller-supplied fingerprint would let the thing being attested choose its own attestation.
 * The one honest reading is: this server took the text it is storing, hashed it, and recorded
 * that. The page the signer read is rendered from the same column in the same request cycle.
 *
 * ⚠️ CONSENT AND A TYPED NAME ARE CHECKED HERE, not only in the browser. They are the two
 * statutory elements (intent, and consent to transact electronically); a UI-only check means the
 * elements are absent for anyone who posts directly, which is exactly the record that would be
 * challenged.
 */
export async function recordSignature(
  agreementId: string,
  input: SignInput,
): Promise<SignResult> {
  const s = db();
  if (!s) return { ok: false, reason: 'error' };

  const typed = input.typedName?.trim() ?? '';
  if (!typed) return { ok: false, reason: 'no_name' };
  if (!input.consentedElectronic) return { ok: false, reason: 'no_consent' };

  const agreement = await getAgreement(agreementId);
  if (!agreement) return { ok: false, reason: 'not_found' };
  if (agreement.voided_at) return { ok: false, reason: 'voided' };

  const existing = await getSignature(agreementId);
  if (existing) return { ok: false, reason: 'already_signed' };

  const { data, error } = await s
    .from('agreement_signatures')
    .insert({
      agreement_id: agreementId,
      document_sha256: documentHash(agreement.body_md),
      typed_name: typed.slice(0, 200),
      consented_electronic: true,
      signer_ip: input.signerIp ?? null,
      user_agent: (input.userAgent ?? '').slice(0, 400) || null,
    })
    .select('*')
    .single();

  // The unique index is the real guard against a double-submit racing the check above; a
  // conflict here means "already signed", not "error".
  if (error) {
    const again = await getSignature(agreementId);
    return again ? { ok: false, reason: 'already_signed' } : { ok: false, reason: 'error' };
  }

  await s.from('agreements').update({ status: 'signed' }).eq('id', agreementId);

  return { ok: true, signature: data as AgreementSignature, agreement };
}

/** Create an agreement. Operator-side; the caller is responsible for authorising it. */
export async function createAgreement(input: {
  title: string;
  bodyMd: string;
  partyName: string;
  partyEmail?: string | null;
  signerName: string;
  signerEmail: string;
  createdBy?: string | null;
}): Promise<Agreement | null> {
  const s = db();
  if (!s) return null;
  const { data, error } = await s
    .from('agreements')
    .insert({
      title: input.title,
      body_md: input.bodyMd,
      party_name: input.partyName,
      party_email: input.partyEmail ?? null,
      signer_name: input.signerName,
      signer_email: input.signerEmail,
      created_by: input.createdBy ?? null,
      status: 'draft',
    })
    .select('*')
    .single();
  if (error) return null;
  return data as Agreement;
}
