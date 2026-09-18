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

export function forwardNoticeText(domain: string): string {
  return (
    `Calls to the phone number on ${domain} are being forwarded to you at no charge by QuickSites (quicksites.ai). ` +
    `Callers hear a recording notice first. Reply STOP to stop receiving these calls.`
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

export async function isOptedOut(phone: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('forward_opt_outs')
    .select('phone')
    .eq('phone', phone)
    .maybeSingle();
  return !!data;
}

/**
 * Send the notice once per campaign. Returns why it did not send when it did not; never throws
 * for a business reason (opted out / already sent / no number) — those are outcomes, not errors.
 */
export async function sendForwardNotice(
  campaignId: string
): Promise<
  | { sent: true }
  | {
      sent: false;
      reason: 'no_forward_to' | 'already_sent' | 'opted_out' | 'sms_failed';
      detail?: string;
    }
> {
  const { data: c, error } = await supabaseAdmin
    .from('geo_industry_campaigns')
    .select('id, domain, forward_to, forward_notice_sent_at')
    .eq('id', campaignId)
    .maybeSingle();
  if (error || !c) throw new Error(`campaign lookup failed: ${error?.message ?? 'not found'}`);
  if (!c.forward_to) return { sent: false, reason: 'no_forward_to' };
  if (c.forward_notice_sent_at) return { sent: false, reason: 'already_sent' };
  if (await isOptedOut(c.forward_to)) return { sent: false, reason: 'opted_out' };

  const r = await sendSms(c.forward_to, forwardNoticeText(c.domain));
  if (!r.ok) return { sent: false, reason: 'sms_failed', detail: r.error };
  await supabaseAdmin
    .from('geo_industry_campaigns')
    .update({
      forward_notice_sent_at: new Date().toISOString(),
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
