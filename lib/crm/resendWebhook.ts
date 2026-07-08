// lib/crm/resendWebhook.ts
//
// Verify a Resend webhook signature. Resend signs with Svix: an HMAC-SHA256 over
// `${svix-id}.${svix-timestamp}.${body}` using the base64 secret (the part after the
// `whsec_` prefix), base64-encoded, presented as `v1,<sig>` (possibly several,
// space-separated) in the `svix-signature` header. Implemented here to avoid the svix
// dependency. Returns true only on a valid, timestamp-fresh signature.
import crypto from 'crypto';

const TOLERANCE_MS = 5 * 60 * 1000; // reject replays older/newer than 5 minutes

export function verifyResendSignature(opts: {
  secret: string; // RESEND_WEBHOOK_SECRET, e.g. "whsec_abc..."
  body: string; // raw request body
  svixId: string | null;
  svixTimestamp: string | null;
  svixSignature: string | null;
  now?: number;
}): boolean {
  const { secret, body, svixId, svixTimestamp, svixSignature } = opts;
  if (!secret || !body || !svixId || !svixTimestamp || !svixSignature) return false;

  // Timestamp freshness (seconds since epoch).
  const ts = Number(svixTimestamp) * 1000;
  if (!Number.isFinite(ts) || Math.abs((opts.now ?? Date.now()) - ts) > TOLERANCE_MS) return false;

  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const signed = `${svixId}.${svixTimestamp}.${body}`;
  const expected = crypto.createHmac('sha256', secretBytes).update(signed).digest('base64');
  const expectedBuf = Buffer.from(expected);

  // Header may carry multiple space-separated `v1,<sig>` entries; accept any match.
  for (const part of svixSignature.split(' ')) {
    const sig = part.startsWith('v1,') ? part.slice(3) : part;
    const sigBuf = Buffer.from(sig);
    if (sigBuf.length === expectedBuf.length && crypto.timingSafeEqual(sigBuf, expectedBuf)) return true;
  }
  return false;
}

/** Map a Resend event type → the first-touch timestamp column on crm_campaign_sends. */
export function engagementColumnForEvent(type: string): 'opened_at' | 'clicked_at' | 'bounced_at' | 'complained_at' | null {
  switch (type) {
    case 'email.opened': return 'opened_at';
    case 'email.clicked': return 'clicked_at';
    case 'email.bounced': return 'bounced_at';
    case 'email.complained': return 'complained_at';
    default: return null;
  }
}
