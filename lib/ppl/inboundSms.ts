// lib/ppl/inboundSms.ts — what happens when a business texts our number back.
//
// Before 2026-10-18 the inbound route answered STOP / START / a survey letter and dropped every
// other reply silently — the day the first pitch text went out, "sure, how do I pay?" would have
// vanished. Now every inbound text is stored, matched to the campaign whose forward-to it came
// from, and emailed to the owner with the pitch state and the obvious next move. No auto-reply
// to a human's words: the honest answer to "how do I pay" is a person, and the email is the handoff.
import { supabaseAdmin } from '@/lib/supabase/admin';
import { last10 } from '@/lib/ppl/ownNumberCall';
import { sendEmail } from '@/lib/email';
import { alertRecipients } from '@/lib/ppl/callAlert';
import { automationRemindersHtml } from '@/lib/ppl/automationStatus';
import { publicBaseUrl } from '@/lib/outreach/competitionPoster';

export type InboundKind = 'stop' | 'start' | 'outcome' | 'reply';

export type MatchedCampaign = { id: string; domain: string; forward_to_name: string | null; pitch_texted_at: string | null; pitch_followup_at: string | null; pitch_deal: string | null; pitch_result: string | null };

/** The campaign this number is the forward-to of (last ten digits), if any. */
export async function campaignForNumber(from: string): Promise<MatchedCampaign | null> {
  const d10 = last10(from);
  if (d10.length < 7) return null;
  const { data } = await supabaseAdmin
    .from('geo_industry_campaigns')
    .select('id, domain, forward_to, forward_to_name, pitch_texted_at, pitch_followup_at, pitch_deal, pitch_result')
    .ilike('forward_to', `%${d10}`)
    .limit(5);
  const row = (data ?? []).find((r) => last10(r.forward_to) === d10);
  return row ? { id: row.id, domain: row.domain, forward_to_name: row.forward_to_name, pitch_texted_at: row.pitch_texted_at, pitch_followup_at: row.pitch_followup_at, pitch_deal: row.pitch_deal, pitch_result: row.pitch_result } : null;
}

export async function recordInboundSms(args: { from: string; to: string | null; body: string; kind: InboundKind; sid?: string | null; campaign: MatchedCampaign | null }): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('sms_messages')
    .insert({ direction: 'in', from_number: args.from, to_number: args.to, body: String(args.body ?? '').slice(0, 1600), kind: args.kind, geo_campaign_id: args.campaign?.id ?? null, business_name: args.campaign?.forward_to_name ?? null, twilio_sid: args.sid ?? null })
    .select('id')
    .single();
  if (error) return null;
  return data.id as string;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The sentence under the reply: where the pitch stands and what to do with this. Pure. */
export function replyNextMove(c: MatchedCampaign | null, kind: InboundKind): string {
  if (!c) return 'This number is not the forward-to of any campaign — a stranger, a wrong number, or a business we re-pointed away from. Read it and decide.';
  if (kind === 'stop') return `${c.forward_to_name || 'They'} opted out of texts. Nothing more goes to this number by text; if the line still forwards to them, a call is the only channel left.`;
  if (kind === 'start') return `${c.forward_to_name || 'They'} re-enabled texts.`;
  if (kind === 'outcome') return 'A survey answer; it is recorded on the call.';
  if (c.pitch_result === 'paid') return 'They are a paying account — treat this as a customer message and answer it.';
  if (c.pitch_texted_at) return `They are replying to the pitch${c.pitch_followup_at ? ' (after the follow-up)' : ''}. Call them now, opening with their reply — the console script is on /admin/ppl → Prepare the call. If they want to pay, Resend the pay link from the "They said yes" tab; it is the same link as the text.`;
  return 'No pitch has gone to this line yet, so this is a reply to a call notice or a question. Answer it by phone.';
}

/** Email the owner one reply; marks the row emailed only after the send resolves. */
export async function emailInboundReply(rowId: string | null, args: { from: string; body: string; kind: InboundKind; campaign: MatchedCampaign | null }): Promise<boolean> {
  const to = alertRecipients();
  if (!to.length) return false;
  const who = args.campaign ? `${args.campaign.forward_to_name || args.from} (${args.campaign.domain})` : args.from;
  const subject = args.kind === 'stop' ? `STOP from ${who}` : args.kind === 'start' ? `START from ${who}` : `Text reply from ${who}: "${args.body.slice(0, 60)}${args.body.length > 60 ? '…' : ''}"`;
  const html = `<div style="font:14px/1.5 -apple-system,Segoe UI,sans-serif;max-width:640px">
    <p><strong>${esc(who)}</strong> texted our number${args.campaign ? '' : ' (no campaign matched)'}:</p>
    <blockquote style="border-left:3px solid #ccc;margin:0;padding:6px 10px;color:#333;font-size:15px">${esc(args.body)}</blockquote>
    <p><strong>Where it stands:</strong> ${esc(replyNextMove(args.campaign, args.kind))}</p>
    <p style="color:#666;font-size:12px">From ${esc(args.from)}. No automatic reply was sent — a human answers this.${args.campaign ? ` <a href="${publicBaseUrl()}/admin/ppl">/admin/ppl</a>` : ''}</p>
    ${automationRemindersHtml()}
  </div>`;
  try {
    await sendEmail({ to: to.join(','), subject, html });
    if (rowId) await supabaseAdmin.from('sms_messages').update({ emailed_at: new Date().toISOString() }).eq('id', rowId);
    return true;
  } catch {
    return false;
  }
}

export type ThreadMessage = { received_at: string; body: string; direction: 'in' | 'out'; kind: InboundKind | null; reason: string | null; ok: boolean | null };

/** The text thread with a campaign's business, both directions, newest first. */
export async function recentMessagesForCampaign(campaignId: string, limit = 8): Promise<ThreadMessage[]> {
  const { data } = await supabaseAdmin.from('sms_messages').select('received_at, body, direction, kind, reason, ok').eq('geo_campaign_id', campaignId).order('received_at', { ascending: false }).limit(limit);
  return (data ?? []) as ThreadMessage[];
}
