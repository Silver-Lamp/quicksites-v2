// lib/sms/smsLog.ts — every text we SEND is recorded and emailed to the owner.
//
// Owner, 2026-10-18: "can I get emailed when sms replies come in? and when they go out". The
// one sender (lib/sms/sendSms.ts) calls `logOutboundSms` after Twilio answers, so a text cannot
// leave this system unrecorded whichever feature sent it. Fire-and-forget: nothing here can
// change a send's result or slow a Twilio webhook. Kept to the smallest import set on purpose
// (no lib/ppl modules) so the sender itself never joins an import cycle.
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email';
import { automationRemindersHtml } from '@/lib/ppl/automationStatus';

const last10 = (s: string | null | undefined) => String(s ?? '').replace(/\D/g, '').slice(-10);
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export type SmsMeta = { reason?: string; campaignId?: string | null };

type Matched = { id: string; domain: string; forward_to_name: string | null } | null;

async function matchCampaign(to: string, campaignId?: string | null): Promise<Matched> {
  if (campaignId) {
    const { data } = await supabaseAdmin.from('geo_industry_campaigns').select('id, domain, forward_to_name').eq('id', campaignId).maybeSingle();
    if (data) return data as Matched;
  }
  const d10 = last10(to);
  if (d10.length < 7) return null;
  const { data } = await supabaseAdmin.from('geo_industry_campaigns').select('id, domain, forward_to, forward_to_name').ilike('forward_to', `%${d10}`).limit(5);
  const row = (data ?? []).find((r) => last10(r.forward_to) === d10);
  return row ? { id: row.id, domain: row.domain, forward_to_name: row.forward_to_name } : null;
}

function recipients(): string[] {
  return String(process.env.ADMIN_EMAILS || '').split(',').map((s) => s.trim()).filter(Boolean);
}

/** Record one outbound text and email the owner. Never throws. */
export async function logOutboundSms(args: { to: string; body: string; ok: boolean; error?: string | null; meta?: SmsMeta }): Promise<void> {
  try {
    const campaign = await matchCampaign(args.to, args.meta?.campaignId).catch(() => null);
    const reason = args.meta?.reason ?? 'unlabelled';
    const { data } = await supabaseAdmin
      .from('sms_messages')
      .insert({ direction: 'out', from_number: process.env.TWILIO_FROM || process.env.TWILIO_PHONE_NUMBER || null, to_number: args.to, body: String(args.body ?? '').slice(0, 1600), reason, ok: args.ok, error: args.error ?? null, geo_campaign_id: campaign?.id ?? null, business_name: campaign?.forward_to_name ?? null })
      .select('id')
      .single();
    const to = recipients();
    if (!to.length) return;
    const who = campaign ? `${campaign.forward_to_name || args.to} (${campaign.domain})` : args.to;
    const subject = `${args.ok ? 'Text sent' : 'Text FAILED'} → ${who}: "${args.body.slice(0, 60)}${args.body.length > 60 ? '…' : ''}"`;
    const html = `<div style="font:14px/1.5 -apple-system,Segoe UI,sans-serif;max-width:640px">
      <p><strong>${args.ok ? 'Sent' : 'Failed to send'}</strong> to <strong>${esc(who)}</strong> · reason: <code>${esc(reason)}</code>${args.error ? ` · error: ${esc(String(args.error))}` : ''}</p>
      <blockquote style="border-left:3px solid #ccc;margin:0;padding:6px 10px;color:#333">${esc(args.body)}</blockquote>
      <p style="color:#666;font-size:12px">Every text this system sends is recorded in sms_messages and emailed here. A reply from them will arrive as its own email.</p>
      ${automationRemindersHtml()}
    </div>`;
    await sendEmail({ to: to.join(','), subject, html });
    if (data?.id) await supabaseAdmin.from('sms_messages').update({ emailed_at: new Date().toISOString() }).eq('id', data.id);
  } catch {
    /* never let logging touch the send */
  }
}
