// app/api/cron/ppl-pitch/route.ts — the text-first pitch, run by the hour (flag PPL_PITCH_AUTO_ENABLED, OFF).
//
// Owner, 2026-10-18: automate the texting; "only text on days/hours that make sense for that
// business, and email me every step of the way so I know when I need to intervene".
//
// For every tracked line: paid → mark it and email; a promised re-point date passed with no
// deposit → email INTERVENE (the cron never re-points: nobody is pointed at without a person
// dialling them first); a line with a paid-grade lead and no text → text 1; texted, no deposit,
// the wait over → text 2 — the last two only inside the business's own texting window
// (lib/ppl/sendWindow.ts), else wait and say when. Every send is the SAME function the button
// runs (lib/ppl/pitchSend.ts). One email per step, to ADMIN_EMAILS, with the text as sent and
// what happens next. Capped per run.
import { NextRequest, NextResponse } from 'next/server';
import { runCron } from '@/lib/cron/record';
import { isCronAuthorized } from '@/lib/cron/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email';
import { alertRecipients } from '@/lib/ppl/callAlert';
import { loadPplCorpus } from '@/lib/ppl/corpus';
import { getPplAccountByCampaign } from '@/lib/ppl/accounts';
import { funnelOf, pitchAutoDecision, sendPitchText1, sendPitchText2, type PitchCampaign } from '@/lib/ppl/pitchSend';
import { FOLLOWUP_AFTER_DAYS } from '@/lib/ppl/pitchText';
import { isGoodTimeToText, nextWindowLabel } from '@/lib/ppl/sendWindow';
import { publicBaseUrl } from '@/lib/outreach/competitionPoster';
import { smsConfigured } from '@/lib/sms/sendSms';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_SENDS_PER_RUN = 10;

function enabled(): boolean {
  const v = process.env.PPL_PITCH_AUTO_ENABLED;
  return v === '1' || v === 'true';
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function email(subject: string, lines: string[]): Promise<boolean> {
  const to = alertRecipients();
  if (!to.length) return false;
  const html = `<div style="font:14px/1.5 -apple-system,Segoe UI,sans-serif;max-width:640px">${lines.map((l) => `<p>${l}</p>`).join('')}<p style="color:#888;font-size:12px">Pay-per-call pitch cron · <a href="${publicBaseUrl()}/admin/ppl">/admin/ppl</a></p></div>`;
  try { await sendEmail({ to: to.join(','), subject, html }); return true; } catch { return false; }
}

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return runCron('ppl-pitch', async () => {
    if (!enabled()) return NextResponse.json({ ok: true, skipped: 'disabled' });
    if (!smsConfigured()) return NextResponse.json({ ok: true, skipped: 'sms_not_configured' });
    const corpus = await loadPplCorpus();
    const pitchNowIds = new Set(corpus.pitchNow.map((l) => l.campaignId));
    const { data: camps, error } = await supabaseAdmin
      .from('geo_industry_campaigns')
      .select('*')
      .not('tracking_number', 'is', null)
      .not('forward_to', 'is', null);
    if (error) throw new Error(error.message);
    const now = Date.now();
    const out = { text1: 0, text2: 0, paid: 0, intervene: 0, waiting: 0, outsideWindow: 0, failed: 0, emailed: 0 };
    let sends = 0;
    for (const c of (camps ?? []) as PitchCampaign[]) {
      const funnel = funnelOf(c);
      const account = await getPplAccountByCampaign(c.id).catch(() => null);
      const decision = pitchAutoDecision({ funnel, hasPaidGradeLead: pitchNowIds.has(c.id), accountActive: account?.status === 'active', nowMs: now, followupAfterDays: FOLLOWUP_AFTER_DAYS });
      const who = `${c.forward_to_name || c.forward_to} (${c.domain})`;
      const adminLink = `<a href="${publicBaseUrl()}/admin/ppl">/admin/ppl</a>`;

      if (decision.action === 'mark_paid') {
        await supabaseAdmin.from('geo_industry_campaigns').update({ pitch_result: 'paid', updated_at: new Date().toISOString() }).eq('id', c.id);
        if (!c.pitch_paid_emailed_at) {
          const ok = await email(`Paid: ${who} is on pay-per-call`, [
            `<strong>${esc(who)}</strong> put a deposit on. The account is active and the campaign now bills per call.`,
            `<strong>Do now:</strong> rename the pitch site to ${esc(c.forward_to_name || 'the business')} in the editor (the page must stop asserting a company that does not exist), and check the PPL flag on /status. ${adminLink}`,
          ]);
          if (ok) { out.emailed += 1; await supabaseAdmin.from('geo_industry_campaigns').update({ pitch_paid_emailed_at: new Date().toISOString() }).eq('id', c.id); }
        }
        out.paid += 1;
        continue;
      }
      if (decision.action === 'intervene_repoint') {
        if (!c.pitch_intervene_emailed_at) {
          const ok = await email(`Intervene: re-point ${c.domain} as promised (${decision.by})`, [
            `Text 2 to <strong>${esc(who)}</strong> said the line would be offered to another shop by <strong>${decision.by}</strong>. That date has passed and no deposit has landed.`,
            `<strong>The cron does not re-point.</strong> Test-dial the alternative from an ordinary phone, then use Re-point on the campaign — or decide to leave it and note why. Either way, do it today: a date we do not keep makes every later text worthless. ${adminLink}`,
          ]);
          if (ok) { out.emailed += 1; await supabaseAdmin.from('geo_industry_campaigns').update({ pitch_intervene_emailed_at: new Date().toISOString() }).eq('id', c.id); }
        }
        out.intervene += 1;
        continue;
      }
      if (decision.action === 'wait') { out.waiting += 1; continue; }

      // text1 / text2 — only in the business's own window.
      const win = isGoodTimeToText(now, { region: c.region, industry: c.industry_key });
      if (!win.ok) { out.outsideWindow += 1; continue; }
      if (sends >= MAX_SENDS_PER_RUN) { out.waiting += 1; continue; }
      const r = decision.action === 'text1' ? await sendPitchText1(c.id, { by: 'cron' }) : await sendPitchText2(c.id, { by: 'cron' });
      sends += 1;
      if (!r.ok) {
        out.failed += 1;
        const ok = await email(`Pitch ${decision.action} FAILED for ${who}: ${r.error}`, [`<strong>${esc(who)}</strong> — ${esc(r.error)}${r.detail ? `: ${esc(String(r.detail))}` : ''}. Nothing was stamped. ${adminLink}`]);
        if (ok) out.emailed += 1;
        continue;
      }
      if (decision.action === 'text1') {
        out.text1 += 1;
        const ok = await email(`Pitch text 1 sent to ${who}`, [
          `Sent at ${esc(win.local)} their time:`,
          `<blockquote style="border-left:3px solid #ccc;margin:0;padding:4px 10px;color:#333">${esc(r.text)}</blockquote>`,
          `<strong>What happens next:</strong> if the deposit lands, you get a "Paid" email and the line bills. If not, the follow-up goes in ${FOLLOWUP_AFTER_DAYS} days (next window: ${esc(nextWindowLabel(now + FOLLOWUP_AFTER_DAYS * 86_400_000 - 3_600_000, { region: c.region, industry: c.industry_key }))}). A call from you any time before that is the strongest move — the console script opens with this text. ${adminLink}`,
        ]);
        if (ok) out.emailed += 1;
      } else {
        out.text2 += 1;
        const ok = await email(`Pitch follow-up sent to ${who} — ${r.kind === 'repoint' ? `re-point promised by ${r.by}` : 'last free one'}`, [
          `Sent at ${esc(win.local)} their time:`,
          `<blockquote style="border-left:3px solid #ccc;margin:0;padding:4px 10px;color:#333">${esc(r.text)}</blockquote>`,
          r.kind === 'repoint'
            ? `<strong>You need to act by ${r.by}:</strong> call them first (the script opens with this text). If no deposit lands by then, you will get an "Intervene" email — test-dial <strong>${esc(r.alternative?.name ?? 'the alternative')}</strong> and re-point. The cron will not do that for you. ${adminLink}`
            : `<strong>Next:</strong> call them, opening with this text. There is no other shop in this city and trade, so no re-point is promised. ${adminLink}`,
        ]);
        if (ok) out.emailed += 1;
      }
    }
    return NextResponse.json({ ok: true, ...out, considered: (camps ?? []).length });
  });
}
