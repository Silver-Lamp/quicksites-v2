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
import { analysisLine } from '@/lib/ppl/callAnalysis';

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
  /** From the voicemail transcription (lib/ppl/voicemailSpeech.ts); absent on older rows. */
  voicemail_speech?: string | null;
  voicemail_transcript?: string | null;
  /** From lib/ppl/voicemailVerdict.ts; absent before 2026-10-12. */
  voicemail_verdict?: string | null;
  voicemail_verdict_reason?: string | null;
  /** From the missed-call text (lib/ppl/missedCallNotice.ts); absent on older rows. */
  missed_call_notified_at?: string | null;
  missed_call_notify_result?: Record<string, unknown> | null;
  /** The stored per-call analysis (lib/ppl/callAnalysis.ts); null until the cron has run it. */
  analysis_summary?: string | null;
  analysis?: { read?: string; confidence?: string } | null;
};

/** Human label per outcome. No word here may mean "a person picked up" — see the header. */
const OUTCOME_LABEL: Record<DialOutcome, string> = {
  connected: 'Line open 15s or longer',
  brief: 'Picked up briefly (under 15s)',
  unanswered: 'No answer',
  // ⚠️ Twilio has not reported a final status yet. Not a failure — `classifyDial` deliberately
  // never reads an unknown status as one.
  in_progress: 'Still in progress when we looked',
  // The caller hung up during the announcement or the ring; the business was never reached.
  abandoned: 'Caller hung up before the forward connected',
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
  // Neither dials, so neither has a dial outcome to report.
  if (row.handling === 'voicemail_first' || row.handling === 'screened') return null;
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
      return `Forwarded to ${prettyPhone(row.forwarded_to)}${missedCallSuffix(row)}`;
    case 'voicemail_first': {
      // What the message contained, when we know. A fax tone and a real caller used to read
      // identically here (2026-10-07).
      const base = 'Sent to voicemail (voicemail-first is on for this number)';
      if (row.voicemail_speech === 'no_speech') return `${base} · no speech on the recording — likely fax or robocall`;
      const t = (row.voicemail_transcript ?? '').trim();
      if (row.voicemail_speech === 'speech' && t) return `${base} · they said: "${t.length > 160 ? `${t.slice(0, 157)}…` : t}"${verdictSuffix(row)}`;
      return base;
    }
    case 'screened': {
      // A number on the caller-screen list (lib/ppl/callerScreen.ts): not bridged, offered
      // voicemail. The message, if any, went through the normal judge-and-relay.
      const base = 'Screened — a known sales/lead-gen number, not forwarded; offered voicemail';
      if (row.voicemail_speech === 'no_speech') return `${base} · no speech on the recording`;
      const t = (row.voicemail_transcript ?? '').trim();
      if (row.voicemail_speech === 'speech' && t) return `${base} · they said: "${t.length > 160 ? `${t.slice(0, 157)}…` : t}"${verdictSuffix(row)}`;
      return `${base} · no message left`;
    }
    case 'cascade':
      return 'Offered to the cascade pool';
    default:
      return row.forwarded_to ? `Forwarded to ${prettyPhone(row.forwarded_to)}` : 'Handling not recorded';
  }
}

/**
 * Whether the business was told about a forward that rang out with no message.
 *
 * ⚠️ Reads the RESULT, not the claim timestamp: `missed_call_notified_at` is stamped before the
 * send and only says we tried. "Texted them" is asserted only on `business_sms: true`; a claim
 * with no result or a failed one reads as "tried to text", so the operator knows to relay it
 * by hand rather than assuming the business has the number.
 */
/** The voicemail verdict (2026-10-12): a held non-lead must read as held, not as a lead to relay. */
export function verdictSuffix(row: CallRow): string {
  const v = row.voicemail_verdict;
  if (!v) return '';
  const why = (row.voicemail_verdict_reason ?? '').trim();
  if (v === 'not_lead') return ` · judged NOT a lead${why ? ` (${why})` : ''} — the business was not texted`;
  if (v === 'lead') return ` · judged a lead${why ? ` (${why})` : ''}`;
  return ` · could not judge${why ? ` (${why})` : ''} — treated as a possible lead`;
}

export function missedCallSuffix(row: CallRow): string {
  if (!row.missed_call_notified_at) return '';
  const r = row.missed_call_notify_result ?? null;
  if (r?.business_sms === true) return ' · texted them the caller’s number';
  if (r?.skipped === 'opted_out') return ' · not texted (they opted out)';
  // The caller rang several of our lines within minutes: a dialer, not a lead (2026-10-12).
  if (r?.skipped === 'sweep') {
    const n = typeof r.other_numbers_rung === 'number' ? r.other_numbers_rung : null;
    return ` · not texted — this caller rang ${n != null ? `${n} other` : 'several'} of our lines within minutes (a sweep, not a lead)`;
  }
  return ' · tried to text them the caller’s number — not confirmed';
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
      // Labelled "AI read" — a model's reading of measured facts, never presented as one of them.
      analysis: analysisLine(r),
    };
  });

  const text = lines
    .map((l) =>
      [`${l.when} PT — ${l.from}`, `  Site: ${l.site}`, l.outcome ? `  ${l.outcome}` : null, `  ${l.handling}`, l.analysis ? `  ${l.analysis}` : null]
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
        <td style="padding:10px 12px;border-bottom:1px solid #27272a;font:13px -apple-system,sans-serif;color:#e4e4e7">${l.outcome ? `${esc(l.outcome)}<br>` : ''}<span style="color:#71717a;font-size:12px">${esc(l.handling)}</span>${
          l.analysis ? `<br><span style="color:#a5b4fc;font-size:12px">${esc(l.analysis)}</span>` : ''
        }</td>
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
