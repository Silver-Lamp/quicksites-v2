// scripts/analyze-calls.mts — store an analysis on call_logs rows that have none.
//
//   npx tsx --env-file=.env.local scripts/analyze-calls.mts [limit=20] [--redo]
//
// The cron (/api/cron/call-alert) analyses each new call as it arrives; this is the backfill for
// the calls before 2026-10-12, and `--redo` re-runs rows that already carry one (a prompt change).
// Each row costs one gpt-4o-mini call (~$0.001) and one PostHog query. Prints the read and the
// summary per row so the result is READ, not just counted.
import { createClient } from '@supabase/supabase-js';
import { analyzeAndStore, type CallLogForAnalysis } from '../lib/ppl/callAnalysis';

const args = process.argv.slice(2);
const limit = Number(args.find((a) => /^\d+$/.test(a)) ?? '20') || 20;
const redo = args.includes('--redo');

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!, {
  auth: { persistSession: false },
});

let q = db
  .from('call_logs')
  .select(
    'id, call_sid, from_number, call_status, call_duration, handling, custom_domain, geo_campaign_id, created_at, recording_url, voicemail_speech, voicemail_transcript, voicemail_verdict, voicemail_verdict_reason, voicemail_notify_result, missed_call_notify_result',
  )
  .order('created_at', { ascending: false })
  .limit(limit);
if (!redo) q = q.is('analyzed_at', null);
const { data, error } = await q;
if (error) throw new Error(error.message);
const rows = (data ?? []) as CallLogForAnalysis[];
console.log(`${rows.length} call(s) to analyse${redo ? ' (redo)' : ''}`);
for (const row of rows) {
  const when = new Date(row.created_at).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
  try {
    const r = await analyzeAndStore(db, row);
    console.log(`\n${when} PT · ${row.custom_domain ?? '-'} · ${row.call_status ?? '?'}\n  ${r.read}${r.error ? ` (error: ${r.error})` : ''}: ${r.summary}`);
  } catch (e) {
    console.log(`\n${when} PT · ${row.custom_domain ?? '-'} · FAILED: ${e instanceof Error ? e.message : String(e)}`);
  }
}
