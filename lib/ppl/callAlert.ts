// lib/ppl/callAlert.ts
//
// "A call came in" → an email to the admins, once per call.
//
// ⚠️ WHY A CRON AND NOT THE CALL PATH. The obvious place is the Twilio webhook, and it is the
// wrong one: that handler's job is to return TwiML fast enough to connect a human being. An
// email send sitting in front of that is latency and a failure mode on the one path that must
// never break — and the webhook fires on `ringing`, before the outcome exists, so it could only
// ever report "a call started". A sweep a minute later knows how it ended.
//
// ⚠️ THE OUTCOME IS NOT A STATUS STRING. `classifyDial` exists because Twilio's `completed`
// includes a voicemail the caller talked to, and this repo spent a morning on exactly that
// confusion. The email says `connected` / `brief` / `no answer`, never "answered", because
// nothing we hold can tell a person from a machine that picked up.

import { classifyDial, type DialOutcome } from '@/lib/ppl/forwardHealth';

export type CallRow = {
  id: string;
  call_sid: string | null;
  from_number: string | null;
  to_number: string | null;
  forwarded_to: string | null;
  call_status: string | null;
  call_duration: number | null;
  handling: string | null;
  custom_domain: string | null;
  created_at: string;
};

/** Human label per outcome. No word here may mean "a person picked up" — see the header. */
const OUTCOME_LABEL: Record<DialOutcome, string> = {
  connected: 'Line open 15s or longer',
  brief: 'Picked up briefly (under 15s)',
  unanswered: 'No answer',
  // ⚠️ Twilio has not reported a final status yet. Not a failure — `classifyDial` deliberately
  // never reads an unknown status as one.
  in_progress: 'Still in progress when we looked',
};

/** `+12535550123` → `(253) 555-0123`; anything unexpected is returned unchanged. */
export function prettyPhone(e164: string | null | undefined): string {
  const d = (e164 ?? '').replace(/[^0-9]/g, '');
  if (d.length === 11 && d.startsWith('1')) {
    return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  }
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return e164 || 'unknown';
}

export function outcomeOf(row: CallRow): DialOutcome {
  return classifyDial(row.call_status, row.call_duration ?? null);
}

/**
 * The outcome line, or null when there is no dial to describe.
 *
 * ⚠️ `classifyDial` answers "how did the FORWARD go". A voicemail-first call never dials, so its
 * status stays `ringing` forever and the classifier honestly reports `in_progress` — which read
 * as "Still in progress when we looked" on calls from the previous day, directly contradicting
 * the "Sent to voicemail" line underneath it. Caught by rendering the email against real rows,
 * not by a test: every unit case used a forwarded call.
 */
export function outcomeLine(row: CallRow): string | null {
  if (row.handling === 'voicemail_first') return null;
  const outcome = outcomeOf(row);
  const dur = row.call_duration ? ` · ${row.call_duration}s` : '';
  return OUTCOME_LABEL[outcome] + dur;
}

/**
 * How the call was handled, in words. ⚠️ Read from `handling`, never inferred from
 * `forwarded_to IS NULL` — that is true of four different populations (voicemail-first, a
 * campaign with no destination, a pre-20260861 row, and a failed lookup), which is the whole
 * reason the column exists.
 */
export function handlingLabel(row: CallRow): string {
  switch (row.handling) {
    case 'forward':
      return `Forwarded to ${prettyPhone(row.forwarded_to)}`;
    case 'voicemail_first':
      return 'Sent to voicemail (voicemail-first is on for this number)';
    case 'cascade':
      return 'Offered to the cascade pool';
    default:
      return row.forwarded_to ? `Forwarded to ${prettyPhone(row.forwarded_to)}` : 'Handling not recorded';
  }
}

export type AlertEmail = { subject: string; html: string; text: string };

/** One email covering every call in this sweep. A per-call email buries a real one in noise. */
export function buildCallAlertEmail(rows: CallRow[], baseUrl: string): AlertEmail {
  const n = rows.length;
  const lead = rows[0];
  const subject =
    n === 1
      ? `Call from ${prettyPhone(lead.from_number)}${lead.custom_domain ? ` · ${lead.custom_domain}` : ''}`
      : `${n} calls${lead.custom_domain ? ` · ${lead.custom_domain} and others` : ''}`;

  const lines = rows.map((r) => {
    const when = new Date(r.created_at).toLocaleString('en-US', {
      timeZone: 'America/Los_Angeles',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
    return {
      when,
      from: prettyPhone(r.from_number),
      site: r.custom_domain || '—',
      outcome: outcomeLine(r),
      handling: handlingLabel(r),
    };
  });

  const text = lines
    .map((l) =>
      [`${l.when} PT — ${l.from}`, `  Site: ${l.site}`, l.outcome ? `  ${l.outcome}` : null, `  ${l.handling}`]
        .filter(Boolean)
        .join('\n'),
    )
    .join('\n\n');

  const rowsHtml = lines
    .map(
      (l) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #27272a;font:13px -apple-system,sans-serif;color:#e4e4e7;white-space:nowrap">${esc(l.when)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #27272a;font:600 13px -apple-system,sans-serif;color:#fff;white-space:nowrap">${esc(l.from)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #27272a;font:13px -apple-system,sans-serif;color:#a1a1aa">${esc(l.site)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #27272a;font:13px -apple-system,sans-serif;color:#e4e4e7">${l.outcome ? `${esc(l.outcome)}<br>` : ''}<span style="color:#71717a;font-size:12px">${esc(l.handling)}</span></td>
      </tr>`,
    )
    .join('');

  const html = `<div style="background:#09090b;padding:24px">
  <table style="width:100%;max-width:640px;margin:0 auto;border-collapse:collapse;background:#18181b;border:1px solid #27272a;border-radius:12px;overflow:hidden">
    <tr><td colspan="4" style="padding:16px 12px 4px;font:600 16px -apple-system,sans-serif;color:#fff">
      ${n === 1 ? 'A call came in' : `${n} calls came in`}
    </td></tr>
    ${rowsHtml}
    <tr><td colspan="4" style="padding:14px 12px">
      <a href="${esc(baseUrl)}/admin/call-logs" style="font:600 13px -apple-system,sans-serif;color:#38bdf8;text-decoration:none">Open call logs →</a>
    </td></tr>
  </table>
  <p style="max-width:640px;margin:12px auto 0;font:12px -apple-system,sans-serif;color:#71717a">
    &ldquo;Connected&rdquo; means the line was open 15 seconds or more. It does not mean a person
    answered &mdash; a voicemail the caller talked to looks identical from here.
  </p>
</div>`;

  return { subject, html, text };
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

/** Admin recipients, from the same env the rest of the admin tooling uses. */
export function alertRecipients(): string[] {
  return String(process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
