// lib/ppl/ivr.ts
//
// TwiML for a pay-per-call tracking number. Pure string builders, so the copy is testable.
//
// ⚠️ THE COPY IS THE HONESTY SURFACE, and the draft this replaces got it wrong twice. The
// caller is a member of the public phoning what they believe is a local business. So:
//   - When the business's prepaid balance is out, the caller is told the line is not connecting
//     calls right now — NOT "our crews are at full capacity", which is a lie about the business
//     told in its name to a customer of that business.
//   - No claims about the business the business never made to us: not "licensed", not
//     "insured", not "specialist". The business name, a recording notice, and the bridge.
//   - The recording notice is said BEFORE the bridge, every time (two-party-consent states).
// A test greps the output for the forbidden phrases.

function esc(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c] as string
  );
}

const VOICE = 'polly.Joanna';
const HEADER = '<?xml version="1.0" encoding="UTF-8"?>';

export function recordingNotice(businessName: string): string {
  return `Thank you for calling ${businessName}. This call may be recorded. Please hold while we connect you.`;
}

/** The bridge: notice → dial the business → the action URL receives the outcome for billing. */
export function bridgeTwiml(args: {
  businessName: string;
  forwardTo: string;
  actionUrl: string;
  whisperUrl?: string;
  timeoutSeconds?: number;
  /** The number presented to the business — OUR tracking number (see below), never the caller's. */
  callerId?: string | null;
}): string {
  const timeout = args.timeoutSeconds ?? 25;
  // Present OUR tracking number. Twilio's default on a forward is the caller's number, and on
  // 2026-09-19 every such leg failed in 0 s with no SIP response and no STIR attestation — Twilio
  // refused to place a call presenting a number the account does not own (an Aug-20 call through
  // the old flow still got attestation C; that window has closed). The caller's number is spoken
  // in the whisper so the business still hears who is calling.
  const callerId = args.callerId ? ` callerId="${esc(args.callerId)}"` : '';
  const num = args.whisperUrl
    ? `<Number url="${esc(args.whisperUrl)}">${esc(args.forwardTo)}</Number>`
    : `<Number>${esc(args.forwardTo)}</Number>`;
  return (
    `${HEADER}<Response>` +
    `<Say voice="${VOICE}">${esc(recordingNotice(args.businessName))}</Say>` +
    `<Dial record="record-from-answer-dual" answerOnBridge="true" timeout="${timeout}"${callerId} ` +
    `action="${esc(args.actionUrl)}" method="POST">${num}</Dial>` +
    `</Response>`
  );
}

/** The balance is out (or the account is paused): say so plainly, take a message, hang up. */
export function notConnectingTwiml(args: {
  businessName: string;
  recordActionUrl?: string;
}): string {
  const say = `Thank you for calling ${args.businessName}. This line is not connecting calls right now.`;
  const record = args.recordActionUrl
    ? ` Please leave a message after the tone and the business will get back to you.</Say>` +
      `<Record maxLength="120" action="${esc(args.recordActionUrl)}" method="POST"/>`
    : ` Please try again later.</Say>`;
  return `${HEADER}<Response><Say voice="${VOICE}">${esc(say)}${record}</Response>`;
}

/** After the bridge attempt: nothing more to say — Twilio ends the call. */
export function hangupTwiml(): string {
  return `${HEADER}<Response><Hangup/></Response>`;
}

/**
 * Phrases the IVR may never say. Each one is a claim about the business made in its name, or a
 * false reason given to its customer. Exported so the test and any future copy share one list.
 */
export const FORBIDDEN_IVR_PHRASES = [
  'licensed',
  'insured',
  'specialist',
  'capacity',
  'high volume',
  'seasonal',
  'guarantee',
  'escrow',
  '24/7',
];
