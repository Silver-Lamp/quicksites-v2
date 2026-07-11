// lib/outreach/sms/outreachSms.ts
//
// SMS outreach for geo-competition campaigns. COMPLIANCE: cold B2B texting is regulated
// (TCPA + A2P 10DLC). This is gated behind PROSPECT_SMS_ENABLED and every message ends
// with an opt-out — but registration/consent is the operator's responsibility. Prefer
// postcards for cold outreach; use this for warm/cleared follow-up.

import { sendSms } from '@/lib/sms/sendSms';
import { claimUrlFor } from '@/lib/outreach/competitionPoster';

export function prospectSmsEnabled(): boolean {
  return process.env.PROSPECT_SMS_ENABLED === '1' || process.env.PROSPECT_SMS_ENABLED === 'true';
}

/** Compose the outreach text for one business. Always includes an opt-out. */
export function composeOutreachSms(opts: {
  businessName: string;
  domain: string;
  templateId: string;
}): string {
  const url = claimUrlFor(opts.templateId);
  const name = opts.businessName?.trim() || 'there';
  return (
    `Hi ${name} — we built a free website for your business at ${opts.domain}. ` +
    `Preview & claim it before a competitor does: ${url}\n\nReply STOP to opt out.`
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
  templateId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const to = normalizePhone(opts.phone);
  if (!to) return { ok: false, error: 'invalid_phone' };
  const body = composeOutreachSms(opts);
  return sendSms(to, body);
}
