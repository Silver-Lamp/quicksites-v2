// app/api/admin/ppl/pitch/route.ts — the text-first pitch, one campaign at a time (the button).
//
// GET  ?campaignId → funnel, deal, both texts as they WOULD read, the real alternative, next step.
// POST { campaignId, action } → 'text1' { dealKey } · 'text2' · 'resend' · 'called' · 'result'.
// The sends live in lib/ppl/pitchSend.ts and are the SAME functions the hourly cron runs.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/requireUser';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getPplAccountByCampaign } from '@/lib/ppl/accounts';
import { publicBaseUrl } from '@/lib/outreach/competitionPoster';
import type { DealKey } from '@/lib/ppl/pitchPlan';
import { pitchText1, pitchText2, pitchNextStep } from '@/lib/ppl/pitchText';
import { funnelOf, latestLead, alternativeShop, storedAlternative, vetAlternative, rejectAlternative, sendPitchText1, sendPitchText2, resendPitchLink, loadPitchCampaign } from '@/lib/ppl/pitchSend';
import { isGoodTimeToText, nextWindowLabel } from '@/lib/ppl/sendWindow';
import { recentMessagesForCampaign } from '@/lib/ppl/inboundSms';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;
  const campaignId = new URL(req.url).searchParams.get('campaignId') ?? '';
  const c = await loadPitchCampaign(campaignId).catch(() => null);
  if (!c) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const funnel = funnelOf(c);
  const dealKey: DealKey = funnel.deal ?? 'next';
  const [lead, stored, computed, account, replies] = await Promise.all([latestLead(c.id), storedAlternative(c), alternativeShop(c), getPplAccountByCampaign(c.id), recentMessagesForCampaign(c.id).catch(() => [])]);
  // Before text 1 the alternative is the candidate we WOULD store; after, it is the one on file (vetted or not).
  const alternative = stored ? { id: stored.id, name: stored.name, phone: stored.phone, vetted: stored.vetted, stored: true } : computed ? { ...computed, vetted: false, stored: false } : null;
  const base = publicBaseUrl();
  const placeholder = `${base}/leads/pay/…`;
  const t1 = pitchText1({ domain: c.domain, lead, deal: dealKey, checkoutUrl: placeholder, termsUrl: `${base}/leads/terms` });
  const t2 = pitchText2({ domain: c.domain, deal: dealKey, checkoutUrl: placeholder, alternative: alternative ? { name: alternative.name } : null, sentAt: new Date() });
  const win = isGoodTimeToText(Date.now(), { region: c.region, industry: c.industry_key });
  return NextResponse.json({
    ok: true,
    funnel,
    sentBy: c.pitch_sent_by ?? null,
    next: pitchNextStep(funnel),
    account: account ? { status: account.status, balance_cents: account.balance_cents } : null,
    to: c.forward_to,
    lead,
    alternative,
    window: { ...win, next: win.ok ? null : nextWindowLabel(Date.now(), { region: c.region, industry: c.industry_key }) },
    replies,
    preview: { text1: t1, text2: t2.text, text2Kind: t2.kind, text2By: t2.by?.toISOString() ?? null },
  });
}

const Body = z.object({
  campaignId: z.string().uuid(),
  action: z.enum(['text1', 'text2', 'resend', 'called', 'result', 'vet', 'reject_alt']),
  dealKey: z.enum(['next', 'package']).optional(),
  result: z.enum(['paid', 'no', 'later', 'no_reply', 'repointed']).optional(),
  notes: z.string().max(2000).optional(),
});

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid', issues: parsed.error.issues }, { status: 400 });
  const b = parsed.data;
  if (b.action === 'text1' || b.action === 'text2' || b.action === 'resend') {
    const r = b.action === 'text1' ? await sendPitchText1(b.campaignId, { dealKey: b.dealKey, by: 'operator' })
      : b.action === 'text2' ? await sendPitchText2(b.campaignId, { by: 'operator' })
      : await resendPitchLink(b.campaignId, { dealKey: b.dealKey });
    if (!r.ok) return NextResponse.json({ error: r.error, detail: r.detail ?? null }, { status: r.error === 'not_found' ? 404 : r.error === 'send_failed' ? 502 : 409 });
    return NextResponse.json({ ok: true, sent: r.text, to: r.to, accountCreated: r.accountCreated });
  }
  if (b.action === 'vet') return NextResponse.json({ ok: await vetAlternative(b.campaignId) });
  if (b.action === 'reject_alt') return NextResponse.json({ ok: true, ...(await rejectAlternative(b.campaignId)) });
  const c = await loadPitchCampaign(b.campaignId).catch(() => null);
  if (!c) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { updated_at: now };
  if (b.action === 'called') patch.pitch_called_at = now;
  if (b.action === 'result') { patch.pitch_result = b.result ?? null; if (b.notes != null) patch.pitch_notes = b.notes; }
  const { error } = await supabaseAdmin.from('geo_industry_campaigns').update(patch).eq('id', c.id);
  if (error) return NextResponse.json({ error: 'stamp_failed', detail: error.message }, { status: 502 });
  return NextResponse.json({ ok: true });
}
