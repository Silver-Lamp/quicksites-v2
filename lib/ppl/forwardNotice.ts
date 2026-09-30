// lib/ppl/forwardNotice.ts
//
// The one-time notice to a business whose phone a campaign forwards to, and the STOP that
// undoes it (docs/PPL_VERTICAL.md §9). Pure text + decision functions are exported for tests;
// the two I/O functions are thin.
//
// The notice makes no promise and no pitch. It says what is happening, who is doing it, and
// how to make it stop. The pitch, if there ever is one, comes weeks later with a call count.

import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendSms } from '@/lib/sms/sendSms';
import { getSenderProfile } from '@/lib/outreach/senderProfile';
import { KEY_TO_LABEL } from '@/lib/industries';

/**
 * The notice, in the operator's voice (Sandon's wording, 2026-09-18). "Calls", never "leads":
 * a lead is our word for what we might sell later; a call is what is literally landing on their
 * phone today, so the message stays a notice and not the start of a pitch. `senderName` comes
 * from the outreach sender profile so a reseller's notice carries their name, not ours.
 */
export function forwardNoticeText(
  domain: string,
  opts: { senderName?: string | null; industryLabel?: string | null } = {}
): string {
  const first = (opts.senderName ?? '').trim().split(/\s+/)[0] || '';
  const who = first ? `Hey, ${first} here from QuickSites.` : 'Hey, this is QuickSites.';
  const kind = opts.industryLabel ? `${opts.industryLabel} calls` : 'Calls';
  return (
    `${who} ${kind} that come in to ${domain} are being forwarded to you at no charge. ` +
    `Callers hear a short "this call may be recorded" notice first. Reply STOP any time to stop receiving them.`
  );
}

/** Twilio passes OptOutType=STOP for the standard keywords; we also match the words directly. */
export function isStopMessage(
  body: string | null | undefined,
  optOutType?: string | null
): boolean {
  if (optOutType && optOutType.toUpperCase() === 'STOP') return true;
  const b = (body ?? '').trim().toUpperCase();
  return ['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT'].includes(b);
}

export function stopConfirmationText(): string {
  return 'Done — calls will no longer be forwarded to this number. Reply START to resume.';
}

export function isStartMessage(
  body: string | null | undefined,
  optOutType?: string | null
): boolean {
  if (optOutType && optOutType.toUpperCase() === 'START') return true;
  const b = (body ?? '').trim().toUpperCase();
  return ['START', 'UNSTOP', 'YES'].includes(b);
}

/** Digits-only comparison, so `(253) 326-5555` and `+12533265555` are the same destination. */
function samePhone(a: string | null | undefined, b: string | null | undefined): boolean {
  const norm = (v: string | null | undefined) => {
    const d = String(v ?? '').replace(/\D+/g, '');
    return d.length === 11 && d.startsWith('1') ? d.slice(1) : d;
  };
  const x = norm(a);
  return !!x && x === norm(b);
}

/**
 * Has THIS destination been told?
 *
 * ⚠️ The legacy fallback is the load-bearing half. Rows written before 20260861 have a timestamp
 * and no `forward_notice_sent_to`; treating those as unnotified would re-text twelve businesses
 * that were already told two days ago, which is spam we would have caused by improving our own
 * bookkeeping. So a timestamp with no recorded subject still counts as sent — but ONLY while the
 * subject is unknown. Once a destination is recorded, it is the answer.
 */
export function noticeAlreadySent(
  forwardTo: string | null,
  noticeSentTo: string | null | undefined,
  noticeSentAt: string | null | undefined,
): boolean {
  if (noticeSentTo) return samePhone(forwardTo, noticeSentTo);
  return !!noticeSentAt;
}

export async function isOptedOut(phone: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('forward_opt_outs')
    .select('phone')
    .eq('phone', phone)
    .maybeSingle();
  return !!data;
}

/**
 * Send the notice once per DESTINATION. Returns why it did not send when it did not; never
 * throws for a business reason (opted out / already sent / no number) — those are outcomes,
 * not errors.
 *
 * ⚠️ "ALREADY SENT" IS A CLAIM ABOUT A PHONE NUMBER, NOT ABOUT A CAMPAIGN. This used to return
 * `already_sent` whenever `forward_notice_sent_at` was non-null, which is a timestamp with no
 * subject. The moment a campaign was re-pointed — the whole purpose of `set-forward` — the new
 * business would start receiving a stranger's towing calls having been told nothing, while the
 * system recorded the notice as handled. The notice is the consent path, so the check compares
 * `forward_notice_sent_to` with the current `forward_to` (20260861) and a changed destination is
 * an unnotified one by definition.
 */
export async function sendForwardNotice(campaignId: string): Promise<
  | { sent: true }
  | {
      sent: false;
      reason: 'no_forward_to' | 'already_sent' | 'opted_out' | 'sms_failed';
      detail?: string;
    }
> {
  const { data: c, error } = await supabaseAdmin
    .from('geo_industry_campaigns')
    .select('id, domain, industry_key, forward_to, forward_notice_sent_at, forward_notice_sent_to')
    .eq('id', campaignId)
    .maybeSingle();
  if (error || !c) throw new Error(`campaign lookup failed: ${error?.message ?? 'not found'}`);
  if (!c.forward_to) return { sent: false, reason: 'no_forward_to' };
  if (noticeAlreadySent(c.forward_to, c.forward_notice_sent_to, c.forward_notice_sent_at)) {
    return { sent: false, reason: 'already_sent' };
  }
  if (await isOptedOut(c.forward_to)) return { sent: false, reason: 'opted_out' };

  const sender = await getSenderProfile().catch(() => null);
  const industryLabel = c.industry_key
    ? ((KEY_TO_LABEL as Record<string, string>)[c.industry_key] ?? null)
    : null;
  const r = await sendSms(
    c.forward_to,
    forwardNoticeText(c.domain, { senderName: sender?.name ?? null, industryLabel })
  );
  if (!r.ok) return { sent: false, reason: 'sms_failed', detail: r.error };
  await supabaseAdmin
    .from('geo_industry_campaigns')
    .update({
      forward_notice_sent_at: new Date().toISOString(),
      // Recorded together with the timestamp: a send whose subject is not written down is the
      // gap this whole change closes.
      forward_notice_sent_to: c.forward_to,
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaignId);
  return { sent: true };
}

/**
 * A STOP from `phone`: record the opt-out and clear the forward on EVERY campaign that used it.
 * Idempotent. Returns how many campaigns were cleared.
 */
export async function applyStop(
  phone: string,
  source: 'sms_stop' | 'operator' = 'sms_stop'
): Promise<{ cleared: number }> {
  await supabaseAdmin.from('forward_opt_outs').upsert({ phone, source }, { onConflict: 'phone' });
  const { data } = await supabaseAdmin
    .from('geo_industry_campaigns')
    .update({
      forward_to: null,
      forward_opted_out_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('forward_to', phone)
    .select('id');
  return { cleared: data?.length ?? 0 };
}

/** START after a STOP: forget the opt-out. The forward is NOT restored automatically — an operator re-attaches. */
export async function applyStart(phone: string): Promise<void> {
  await supabaseAdmin.from('forward_opt_outs').delete().eq('phone', phone);
}
