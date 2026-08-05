// lib/agreements/notify.ts
//
// Tell both parties that an agreement was signed, and give the signer the artefact.
//
// ⚠️ THE SIGNER'S EMAIL CARRIES THE CERTIFICATE AS AN ATTACHMENT, NOT A LINK. That is the whole
// point of the artefact-not-dependency rule (crosstalk/contracts/agreements-record.md §2.6): the
// person who signed ends up holding the evidence in their own inbox, and does not have to come
// back to us — or ask the other party — for a copy of what they agreed to. A link would put the
// weaker party's evidence on the stronger party's server, which is the thing this product exists
// to avoid.
//
// ⚠️ NOTIFICATION CAN NEVER FAIL THE SIGNATURE. It runs after the record is written; a bounced
// email must not undo an agreement. But the inverse failure is the dangerous one — a send that
// fails silently leaves a signature that looks complete with nobody told — so the outcome is
// written back to the row (`notified_at` / `notify_error`) rather than logged and forgotten.
//
// ⚠️ THE COPY DOES NOT OVERCLAIM, in the email any more than on the page. No "legally binding",
// no "certified". It says what was recorded. An email is where that discipline is most likely to
// slip, because it is the part that reads like an announcement.

import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email';
import { agreementCertificateHtml, formatSignedAt } from './certificate';
import { shortHash } from './document';
import type { Agreement, AgreementSignature } from './store';

function certificateFilename(title: string): string {
  const base = title.toLowerCase().replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return `${base || 'agreement'}-signed.html`;
}

function wrap(bodyHtml: string): string {
  return `<div style="font:16px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;max-width:34rem">
${bodyHtml}
</div>`;
}

/**
 * Turn whatever the mailer handed back into something a human can act on.
 *
 * ⚠️ `String(err)` ON A PROVIDER ERROR OBJECT PRODUCES "[object Object]", AND THAT IS EXACTLY WHAT
 * THIS COLUMN GOT ON ITS FIRST REAL RUN. The whole point of notify_error is that a failed notice
 * on a legal record is visible and diagnosable; an error string that names no cause is a louder
 * version of the silence it replaced. The real message was "API key is invalid" — one glance
 * would have saved a probe.
 */
export function describeSendError(err: unknown): string {
  if (!err) return 'send failed';
  if (typeof err === 'string') return err;
  const e = err as any;
  const parts = [e.name, e.message ?? e.error, e.statusCode ? `HTTP ${e.statusCode}` : null]
    .filter(Boolean)
    .map(String);
  if (parts.length) return parts.join(': ');
  try {
    return JSON.stringify(err).slice(0, 300);
  } catch {
    return 'send failed (unserialisable error)';
  }
}

/**
 * Was this actually delivered?
 *
 * ⚠️ THE DEV FALLBACK IS NOT A DELIVERY, AND TREATING IT AS ONE IS THE EXACT FAILURE THIS MODULE
 * EXISTS TO PREVENT. `sendEmail` returns `{ ok: true, id: 'dev' }` when no mailer is configured —
 * right for a dev loop, catastrophic here: without this the row records `notified_at`, asserting
 * that both parties hold a copy of a contract nobody was sent.
 *
 * Found by dry-running the backfill for the first real signed agreement. The dry run printed
 * "sent." and stamped the row. A guard against silent failure that silently records success is
 * worse than no guard, because the record now actively lies. Exported so it is testable.
 */
export function isDelivered(r: { ok: boolean; id?: string }): boolean {
  return r.ok && r.id !== 'dev';
}

/**
 * Returns the outcome rather than throwing — the caller has already recorded
 * a signature and must not treat a delivery problem as a failure of it.
 */
export async function notifySigned(
  agreement: Agreement,
  signature: AgreementSignature,
): Promise<{ ok: boolean; error?: string }> {
  const certificate = agreementCertificateHtml({
    title: agreement.title,
    bodyText: agreement.body_md,
    documentSha256: signature.document_sha256,
    partyName: agreement.party_name,
    partyEmail: agreement.party_email,
    signerName: agreement.signer_name,
    signerEmail: agreement.signer_email,
    typedName: signature.typed_name,
    signedAtIso: signature.signed_at,
    signerIp: signature.signer_ip,
    userAgent: signature.user_agent,
  });

  const when = formatSignedAt(signature.signed_at);
  const fingerprint = shortHash(signature.document_sha256);
  const attachments = [{ filename: certificateFilename(agreement.title), content: certificate }];

  const errors: string[] = [];



  // ── The signer. Their copy, to keep. ──────────────────────────────────────
  const toSigner = await sendEmail({
    to: agreement.signer_email,
    subject: `Your signed copy — ${agreement.title}`,
    attachments,
    html: wrap(`
      <p>Hi ${agreement.signer_name},</p>
      <p>You signed <strong>${agreement.title}</strong> on ${when}. Your copy is attached.</p>
      <p>It is a single file that opens in any browser and prints. It works on its own — you do
      not need an account, a link, or us, to read it later. Keep it somewhere you keep documents.</p>
      <p style="color:#555;font-size:14px">The attachment records the name you typed, the time,
      your IP address and browser, and a fingerprint (<code>${fingerprint}</code>) of the exact
      text you were shown, so it can be shown later that this is what you read. It is not identity
      verification or notarisation.</p>
      <p style="color:#555;font-size:14px">If you did not sign this, reply to this email and tell
      ${agreement.party_name} straight away.</p>
    `),
  }).catch((e) => ({ ok: false as const, error: e }));
  if (!isDelivered(toSigner as any)) {
    errors.push(
      (toSigner as any).id === 'dev'
        ? 'signer: no mailer configured — nothing was sent'
        : `signer: ${describeSendError((toSigner as any).error)}`,
    );
  }

  // ── The party who asked for it. ───────────────────────────────────────────
  if (agreement.party_email) {
    const toParty = await sendEmail({
      to: agreement.party_email,
      subject: `Signed: ${agreement.title} — ${signature.typed_name}`,
      attachments,
      html: wrap(`
        <p><strong>${signature.typed_name}</strong> signed <strong>${agreement.title}</strong> on ${when}.</p>
        <p style="color:#555;font-size:14px">
          Sent to: ${agreement.signer_name} &lt;${agreement.signer_email}&gt;<br>
          Typed name: ${signature.typed_name}<br>
          Fingerprint: <code>${fingerprint}</code>
        </p>
        <p>The signed copy is attached. The document is now frozen — its text can no longer be
        changed, which is what makes the fingerprint mean anything.</p>
      `),
    }).catch((e) => ({ ok: false as const, error: e }));
    if (!isDelivered(toParty as any)) {
      errors.push(
        (toParty as any).id === 'dev'
          ? 'party: no mailer configured — nothing was sent'
          : `party: ${describeSendError((toParty as any).error)}`,
      );
    }
  } else {
    // Not an error, but worth recording: half the requirement ("both parties get notices") cannot
    // be met when the agreement was created without one.
    errors.push('party: no party_email on the agreement');
  }

  const ok = errors.length === 0;

  // Write the outcome back. Best-effort — but a failure to record the failure is itself only a
  // log line, which is as far as this can honestly go without recursing.
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
    if (url && key) {
      await createClient(url, key, { auth: { persistSession: false } })
        .from('agreement_signatures')
        .update({
          notified_at: ok ? new Date().toISOString() : null,
          notify_error: ok ? null : errors.join('; ').slice(0, 500),
        })
        .eq('id', signature.id);
    }
  } catch (e) {
    console.error('[agreements] could not record notification outcome', e);
  }

  if (!ok) console.error('[agreements] notification failed', errors);
  return ok ? { ok: true } : { ok: false, error: errors.join('; ') };
}
