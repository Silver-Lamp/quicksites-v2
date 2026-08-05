// lib/agreements/ledger.ts
//
// Every agreement in the system, with the three things an operator actually needs to know:
// was it signed, does it still verify, and was anyone told.
//
// ⚠️ THE INTEGRITY CHECK IS RECOMPUTED HERE, NOT READ FROM A COLUMN. Storing "verified: true"
// somewhere would just be a second claim needing its own verification. The check is cheap
// (SHA-256 of a stored string) and it is the entire promise of the product, so it runs on every
// view — a ledger that reported integrity from a cached flag would be exactly the input-inspecting
// verification this repo keeps getting burned by.
//
// ⚠️ AND `unverifiable` IS A DISTINCT STATE FROM `altered`. A signature row with no stored hash is
// not evidence of tampering; it is evidence of nothing. Collapsing the two would either cry wolf
// or bless a record nobody can check.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { verifyDocument, type HashVerdict } from './document';

export type LedgerRow = {
  id: string;
  title: string;
  partyName: string;
  signerName: string;
  signerEmail: string;
  status: string;
  createdAt: string;
  voidedAt: string | null;
  voidedReason: string | null;
  /** Null when nobody has signed yet. */
  signature: {
    id: string;
    typedName: string;
    signedAt: string;
    documentSha256: string;
    signerIp: string | null;
    /** Null + null error = notification never ran. See migration 20260820. */
    notifiedAt: string | null;
    notifyError: string | null;
  } | null;
  /** Recomputed on read. See the header. */
  integrity: HashVerdict | 'unsigned';
};

export type AcceptanceRow = {
  id: string;
  documentTitle: string | null;
  typedName: string;
  email: string | null;
  acceptedAt: string;
  templateId: string | null;
  documentSha256: string;
  integrity: HashVerdict;
};

function db(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Every agreement, newest first. Caller must have checked operator authorisation. */
export async function listAgreements(): Promise<LedgerRow[]> {
  const s = db();
  if (!s) return [];

  const { data: agreements } = await s
    .from('agreements')
    .select('*')
    .order('created_at', { ascending: false });
  if (!agreements?.length) return [];

  const { data: signatures } = await s
    .from('agreement_signatures')
    .select('*')
    .in('agreement_id', agreements.map((a: any) => a.id));

  const byAgreement = new Map<string, any>();
  for (const sig of signatures ?? []) byAgreement.set(sig.agreement_id, sig);

  return agreements.map((a: any): LedgerRow => {
    const sig = byAgreement.get(a.id);
    return {
      id: a.id,
      title: a.title,
      partyName: a.party_name,
      signerName: a.signer_name,
      signerEmail: a.signer_email,
      status: a.status,
      createdAt: a.created_at,
      voidedAt: a.voided_at,
      voidedReason: a.voided_reason,
      signature: sig
        ? {
            id: sig.id,
            typedName: sig.typed_name,
            signedAt: sig.signed_at,
            documentSha256: sig.document_sha256,
            signerIp: sig.signer_ip,
            notifiedAt: sig.notified_at ?? null,
            notifyError: sig.notify_error ?? null,
          }
        : null,
      // Recomputed against the stored body every time this page is opened.
      integrity: sig ? verifyDocument(a.body_md, sig.document_sha256) : 'unsigned',
    };
  });
}

/**
 * Acceptances from `agreement` blocks on public pages.
 *
 * ⚠️ KEPT IN A SEPARATE LIST FROM SIGNATURES, DELIBERATELY. These record that terms were
 * PRESENTED and someone accepted them; nobody was addressed, so the name is self-reported and
 * there is no identity evidence. Merging the two lists into one "agreements" table in the UI
 * would let a reader carry the signing surface's weight over to a record that never had it.
 */
export async function listAcceptances(limit = 200): Promise<AcceptanceRow[]> {
  const s = db();
  if (!s) return [];
  const { data } = await s
    .from('agreement_acceptances')
    .select('*')
    .order('accepted_at', { ascending: false })
    .limit(limit);

  return (data ?? []).map((r: any) => ({
    id: r.id,
    documentTitle: r.document_title,
    typedName: r.typed_name,
    email: r.email,
    acceptedAt: r.accepted_at,
    templateId: r.template_id,
    documentSha256: r.document_sha256,
    // The full text is stored per row precisely so this is answerable.
    integrity: verifyDocument(r.document_text, r.document_sha256),
  }));
}
