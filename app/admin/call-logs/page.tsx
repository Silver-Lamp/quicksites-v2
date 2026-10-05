// app/admin/call-logs/page.tsx
//
// ⚠️ EVERY STATUS USED TO RENDER GREEN. `text-green-400` was hard-coded on the status cell, so
// "Dial-No-Answer" and "Dial-Failed" read as successes at a glance — which is how covingtontow.com
// dropped two real leads on 2026-09-30 with the evidence sitting on this page the whole time. A
// dashboard that paints failure in the success colour is worse than one that omits it, because it
// is consulted and believed. Colour now comes from `classifyDial`, the same function the health
// rollup uses, so the page cannot disagree with the numbers above it.
import { createClient } from '@supabase/supabase-js';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { classifyDial, type DialOutcome } from '@/lib/ppl/forwardHealth';
import { formatUsPhone } from '@/lib/phone/formatUs';

export const dynamic = 'force-dynamic';

const OUTCOME_CLASS: Record<DialOutcome, string> = {
  connected: 'text-emerald-400',
  // Amber, not green: a "completed" dial too short to be a conversation is usually voicemail
  // picking up. It is not a failure and it is not a lead.
  brief: 'text-amber-300',
  unanswered: 'text-rose-400',
  in_progress: 'text-zinc-400',
  // Grey, not red: the caller left before the bridge, so the business was never reached and
  // this says nothing about the destination.
  abandoned: 'text-zinc-500',
};

const OUTCOME_LABEL: Record<DialOutcome, string> = {
  // ⚠️ Deliberately does not say "answered". The leg lasted, which is all we know — a person
  // talking for 20s and a caller leaving a 20s message on the destination's voicemail produce
  // the identical row. Only a cascade keypress proves a human.
  connected: 'the call went on — could be a person, could be a message left on their voicemail',
  brief: 'too short to be a conversation — likely voicemail',
  unanswered: 'never picked up',
  in_progress: 'no final outcome recorded',
  abandoned: 'caller hung up before the forward connected — the business was never rung',
};

export default async function CallLogsPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!
  );
  const { data: logs } = await supabase
    .from('call_logs')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(50);

  const rows = logs ?? [];
  // Counted over what is on screen, and the heading says so — a summary whose scope is unstated
  // gets read as a fleet total.
  const tally = rows.reduce(
    (acc, l) => {
      acc[classifyDial(l.call_status, l.call_duration)] += 1;
      return acc;
    },
    { connected: 0, brief: 0, unanswered: 0, in_progress: 0, abandoned: 0 } as Record<DialOutcome, number>
  );

  return (
    <div className="p-4 mt-12">
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-xl font-semibold flex items-center gap-2">📞 Twilio Call Logs</h2>
          <p className="text-xs text-zinc-400">
            Last {rows.length} calls ·{' '}
            <span className="text-emerald-400">{tally.connected} connected</span> ·{' '}
            <span className="text-amber-300">{tally.brief} too short</span> ·{' '}
            <span className="text-rose-400">{tally.unanswered} never picked up</span>
            {tally.in_progress > 0 ? ` · ${tally.in_progress} no outcome` : ''}
          </p>
        </div>

        <div className="rounded border border-zinc-700 bg-black/30 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-800/50 text-left text-zinc-400 uppercase text-xs">
              <tr>
                <th className="px-4 py-2">From</th>
                <th className="px-4 py-2">To</th>
                {/* The destination the bridge actually rang. NULL on rows predating 20260861 —
                    shown as "not recorded" rather than filled in from the campaign, which is
                    mutable and would credit today's business with yesterday's failures. */}
                <th className="px-4 py-2">Rang</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2 text-right">Duration</th>
                <th className="px-4 py-2 text-right">Time</th>
                <th className="px-4 py-2">Site</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((log) => {
                const outcome = classifyDial(log.call_status, log.call_duration);
                return (
                  <tr key={log.call_sid} className="border-t border-zinc-800 hover:bg-zinc-800/30">
                    <td className="px-4 py-2 font-mono text-zinc-100">{log.from_number}</td>
                    <td className="px-4 py-2 font-mono text-zinc-100">{log.to_number}</td>
                    <td className="px-4 py-2 font-mono text-zinc-300">
                      {log.forwarded_to ? (
                        formatUsPhone(log.forwarded_to)
                      ) : (
                        <span className="font-sans text-xs italic text-zinc-500">not recorded</span>
                      )}
                    </td>
                    <td className={`px-4 py-2 capitalize ${OUTCOME_CLASS[outcome]}`} title={OUTCOME_LABEL[outcome]}>
                      {log.call_status}
                    </td>
                    <td className="px-4 py-2 text-right text-zinc-200">
                      {log.call_duration ? `${log.call_duration}s` : '-'}
                    </td>
                    <td className="px-4 py-2 text-right text-zinc-400 text-xs">
                      {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                    </td>
                    <td className="px-4 py-2 text-sm">
                      {log.custom_domain ? (
                        <a
                          href={`https://${log.custom_domain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:underline"
                        >
                          {log.custom_domain}
                        </a>
                      ) : log.template_slug ? (
                        <Link
                          href={`/sites/${log.template_slug}`}
                          className="text-blue-400 hover:underline"
                        >
                          {log.template_slug}
                        </Link>
                      ) : (
                        <span className="text-zinc-500 italic">No match</span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center px-4 py-8 text-zinc-500">
                    No call logs found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-zinc-500">
          A call that rings out still costs us the lead and the caller their time, so it is
          coloured as the failure it is. Re-point a campaign that is not being answered from{' '}
          <Link href="/admin/ppl" className="text-blue-400 hover:underline">
            Pay-per-call
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
