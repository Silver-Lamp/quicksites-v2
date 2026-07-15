// lib/outreach/sms/outreachSms.ts
//
// SMS outreach for geo-competition campaigns. COMPLIANCE: cold B2B texting is regulated
// (TCPA + A2P 10DLC). This is gated behind PROSPECT_SMS_ENABLED and every message ends
// with an opt-out — but registration/consent is the operator's responsibility. Prefer
// postcards for cold outreach; use this for warm/cleared follow-up.

import { sendSms } from '@/lib/sms/sendSms';
import { trackedClaimUrl } from '@/lib/outreach/competitionPoster';

export function prospectSmsEnabled(): boolean {
  return process.env.PROSPECT_SMS_ENABLED === '1' || process.env.PROSPECT_SMS_ENABLED === 'true';
}

/** Who's reaching out — mirrors the postcard sign-off so a text feels like the same person. */
export type SmsSender = { name?: string | null; email?: string | null };

/** Compose the outreach text for one business. Always includes an opt-out. When a sender
 *  identity is provided, it signs the message + offers a contact — consistent with the
 *  postcard so a prospect recognizes the same person across channels. */
export function composeOutreachSms(opts: {
  businessName: string;
  domain: string;
  campaignId: string;
  sender?: SmsSender | null;
}): string {
  const url = trackedClaimUrl(opts.campaignId);
  const name = opts.businessName?.trim() || 'there';
  const senderName = opts.sender?.name?.trim() || '';
  const senderEmail = opts.sender?.email?.trim() || '';
  // "— Name (email)" sign-off, whichever parts we have. Kept before the required opt-out.
  const signParts = [senderName, senderEmail].filter(Boolean);
  const signOff = signParts.length ? `\n— ${signParts.join(' · ')}` : '';
  return (
    `Hi ${name} — we built a free website for your business at ${opts.domain}. ` +
    `Preview & claim it before a competitor does: ${url}` +
    `${signOff}\n\nReply STOP to opt out.`
  );
}

/** E.164-ish normalization for a US number; returns null if it can't be made valid. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (raw.trim().startsWith('+')) return raw.trim();
  return null;
}

export async function sendOutreachSms(opts: {
  phone: string;
  businessName: string;
  domain: string;
  campaignId: string;
  sender?: SmsSender | null;
}): Promise<{ ok: boolean; error?: string }> {
  const to = normalizePhone(opts.phone);
  if (!to) return { ok: false, error: 'invalid_phone' };
  const body = composeOutreachSms(opts);
  return sendSms(to, body);
}
