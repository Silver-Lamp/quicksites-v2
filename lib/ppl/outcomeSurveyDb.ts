// lib/ppl/outcomeSurveyDb.ts — the DB half of the did-it-become-a-job survey.
import { supabaseAdmin } from '@/lib/supabase/admin';
import { last10 } from '@/lib/ppl/ownNumberCall';
import { outcomeStats, type OutcomeReply, type OutcomeStats } from '@/lib/ppl/outcomeSurvey';

/**
 * A business replied Y / N / NOT YET: pin it to the most recent call we asked THAT number about
 * and have no answer for. Matched on the last ten digits (forwarded_to is E.164, Twilio's From
 * is E.164 too, but the rule everywhere here is last10 — the 11-vs-10 trap, CLAUDE.md).
 * Returns false when nothing was waiting for an answer from this number.
 */
export async function recordOutcomeReply(from: string, reply: OutcomeReply, raw: string): Promise<boolean> {
  const d10 = last10(from);
  if (d10.length < 7) return false;
  const { data: open } = await supabaseAdmin
    .from('call_logs')
    .select('id, forwarded_to')
    .not('outcome_survey_sent_at', 'is', null)
    .is('outcome_reported', null)
    .ilike('forwarded_to', `%${d10}`)
    .order('outcome_survey_sent_at', { ascending: false })
    .limit(5);
  const row = (open ?? []).find((r) => last10(r.forwarded_to) === d10);
  if (!row) return false;
  const { error } = await supabaseAdmin
    .from('call_logs')
    .update({ outcome_reported: reply, outcome_reported_at: new Date().toISOString(), outcome_reported_raw: String(raw ?? '').slice(0, 200) })
    .eq('id', row.id)
    .is('outcome_reported', null);
  return !error;
}

/** What the business on a campaign has told us so far. */
export async function outcomeStatsForCampaign(campaignId: string): Promise<OutcomeStats> {
  const { data } = await supabaseAdmin
    .from('call_logs')
    .select('outcome_survey_sent_at, outcome_reported')
    .eq('geo_campaign_id', campaignId)
    .not('outcome_survey_sent_at', 'is', null)
    .limit(1000);
  return outcomeStats((data ?? []) as Array<{ outcome_survey_sent_at: string | null; outcome_reported: string | null }>);
}
