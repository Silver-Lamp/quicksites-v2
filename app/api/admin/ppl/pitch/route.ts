// app/api/admin/ppl/pitch/route.ts — the text-first pitch, one campaign at a time.
//
// GET  ?campaignId → where the line is in the funnel, the deal, both texts as they WOULD read
//      (with the real alternative shop for text 2, or none), and the next step.
// POST { campaignId, action } →
//      'text1'  { dealKey }     create the account if none (PENDING — the campaign flips to
//                               pay-per-call only when the deposit lands), mint the deposit
//                               link, send text 1, stamp pitch_texted_at.
//      'text2'                  send the honest follow-up (re-point with a real name and date
//                               where another no-website shop exists, else "last free one"),
//                               stamp pitch_followup_*.
//      'called'                 stamp pitch_called_at.
//      'result' { result, notes } record what happened.
// Never the caller; STOP honoured; every text from the same number the business already knows.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/requireUser';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getGeoCampaign } from '@/lib/outreach/geoCampaigns';
import { getPplAccountByCampaign, createPplAccount } from '@/lib/ppl/accounts';
import { createDepositCheckout } from '@/lib/ppl/billing';
import { isOptedOut } from '@/lib/ppl/forwardNotice';
import { sendSms } from '@/lib/sms/sendSms';
import { publicBaseUrl } from '@/lib/outreach/competitionPoster';
import { DEALS, type DealKey } from '@/lib/ppl/pitchPlan';
import { PPL_DEFAULTS } from '@/lib/ppl/rules';
import { pitchText1, pitchText2, pitchNextStep, type PitchFunnel } from '@/lib/ppl/pitchText';
import { last10 } from '@/lib/ppl/ownNumberCall';
import { classifyDial } from '@/lib/ppl/forwardHealth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type CampaignRow = Awaited<ReturnType<typeof getGeoCampaign>> & Partial<Record<'pitch_deal' | 'pitch_texted_at' | 'pitch_followup_at' | 'pitch_followup_kind' | 'pitch_repoint_prospect_id' | 'pitch_repoint_by' | 'pitch_called_at' | 'pitch_result' | 'pitch_notes', string | null>>;

function funnelOf(c: CampaignRow): PitchFunnel {
  return {
    deal: (c.pitch_deal as DealKey | null) ?? null,
    textedAt: c.pitch_texted_at ?? null,
    followupAt: c.pitch_followup_at ?? null,
    followupKind: (c.pitch_followup_kind as PitchFunnel['followupKind']) ?? null,
    repointBy: c.pitch_repoint_by ?? null,
    calledAt: c.pitch_called_at ?? null,
    result: (c.pitch_result as PitchFunnel['result']) ?? null,
  };
}

/** The latest customer-read, ≥floor call the business took — what text 1 names. */
async function latestLead(campaignId: string): Promise<{ at: string; seconds: number; callerPhone: string | null } | null> {
  const { data } = await supabaseAdmin
    .from('call_logs')
    .select('created_at, call_status, call_duration, from_number, handling, analysis')
    .eq('geo_campaign_id', campaignId)
    .eq('handling', 'forward')
    .order('created_at', { ascending: false })
    .limit(50);
  for (const r of data ?? []) {
    const read = typeof (r as any).analysis?.read === 'string' ? (r as any).analysis.read : null;
    if (read && read !== 'customer') continue;
    if (classifyDial(r.call_status, r.call_duration) !== 'connected') continue;
    if ((r.call_duration ?? 0) < PPL_DEFAULTS.minBillableSeconds) continue;
    return { at: r.created_at, seconds: r.call_duration ?? 0, callerPhone: r.from_number ?? null };
  }
  return null;
}

/** Another no-website shop in the same city + trade, with a phone, not the current forward-to, not opted out. */
async function alternativeShop(c: CampaignRow): Promise<{ id: string; name: string; phone: string } | null> {
  if (!c?.city || !c.industry_key) return null;
  const { data } = await supabaseAdmin
    .from('outreach_prospects')
    .select('id, business_name, phone, rating, review_count')
    .eq('region', 'WA')
    .eq('city', c.city)
    .eq('industry_key', c.industry_key)
    .eq('lead_tier', 'no_website')
    .not('phone', 'is', null)
    .order('review_count', { ascending: false, nullsFirst: false })
    .limit(10);
  const cur = last10(c.forward_to);
  for (const p of data ?? []) {
    if (!p.phone || last10(p.phone) === cur) continue;
    if (await isOptedOut(p.phone).catch(() => false)) continue;
    return { id: p.id, name: p.business_name, phone: p.phone };
  }
  return null;
}

async function depositLink(c: CampaignRow, dealKey: DealKey, businessName: string): Promise<{ url: string; created: boolean }> {
  let account = await getPplAccountByCampaign(c!.id);
  let created = false;
  if (!account) {
    const d = DEALS[dealKey];
    account = await createPplAccount({ geo_campaign_id: c!.id, business_name: businessName, contact_phone: c!.forward_to ?? null, cpl_cents: d.cplCents, min_billable_seconds: PPL_DEFAULTS.minBillableSeconds, reload_threshold_cents: d.reloadThresholdCents, reload_amount_cents: d.reloadAmountCents, auto_reload: true });
    created = true;
  }
  const checkout = await createDepositCheckout(account, DEALS[dealKey].depositCents);
  return { url: checkout.url, created };
}

export async function GET(req: Request) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;
  const campaignId = new URL(req.url).searchParams.get('campaignId') ?? '';
  const c = (await getGeoCampaign(campaignId).catch(() => null)) as CampaignRow | null;
  if (!c) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const funnel = funnelOf(c);
  const dealKey: DealKey = funnel.deal ?? 'next';
  const [lead, alternative, account] = await Promise.all([latestLead(c.id), alternativeShop(c), getPplAccountByCampaign(c.id)]);
  const base = publicBaseUrl();
  const placeholder = `${base}/leads/pay/…`;
  const t1 = pitchText1({ domain: c.domain, lead, deal: dealKey, checkoutUrl: placeholder, termsUrl: `${base}/leads/terms` });
  const t2 = pitchText2({ domain: c.domain, deal: dealKey, checkoutUrl: placeholder, alternative: alternative ? { name: alternative.name } : null, sentAt: new Date() });
  return NextResponse.json({
    ok: true,
    funnel,
    next: pitchNextStep(funnel),
    account: account ? { status: account.status, balance_cents: account.balance_cents } : null,
    to: c.forward_to,
    lead,
    alternative,
    preview: { text1: t1, text2: t2.text, text2Kind: t2.kind, text2By: t2.by?.toISOString() ?? null },
  });
}

const Body = z.object({
  campaignId: z.string().uuid(),
  action: z.enum(['text1', 'text2', 'called', 'result']),
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
  const c = (await getGeoCampaign(b.campaignId).catch(() => null)) as CampaignRow | null;
  if (!c) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const now = new Date();
  const patch: Record<string, unknown> = {};

  if (b.action === 'text1' || b.action === 'text2') {
    if (!c.forward_to) return NextResponse.json({ error: 'no_forward_to' }, { status: 409 });
    if (await isOptedOut(c.forward_to).catch(() => false)) return NextResponse.json({ error: 'opted_out' }, { status: 409 });
    const dealKey: DealKey = b.dealKey ?? (funnelOf(c).deal as DealKey | null) ?? 'next';
    const business = c.forward_to_name || 'the business on the line';
    const { url, created } = await depositLink(c, dealKey, business);
    let text: string;
    if (b.action === 'text1') {
      const lead = await latestLead(c.id);
      text = pitchText1({ domain: c.domain, lead, deal: dealKey, checkoutUrl: url, termsUrl: `${publicBaseUrl()}/leads/terms` });
      patch.pitch_texted_at = now.toISOString();
      patch.pitch_deal = dealKey;
    } else {
      const alt = await alternativeShop(c);
      const t2 = pitchText2({ domain: c.domain, deal: dealKey, checkoutUrl: url, alternative: alt ? { name: alt.name } : null, sentAt: now });
      text = t2.text;
      patch.pitch_followup_at = now.toISOString();
      patch.pitch_followup_kind = t2.kind;
      patch.pitch_repoint_prospect_id = alt?.id ?? null;
      patch.pitch_repoint_by = t2.by ? t2.by.toISOString().slice(0, 10) : null;
    }
    const r = await sendSms(c.forward_to, text);
    if (!r.ok) return NextResponse.json({ error: 'send_failed', detail: r.error ?? null }, { status: 502 });
    patch.updated_at = now.toISOString();
    const { error } = await supabaseAdmin.from('geo_industry_campaigns').update(patch).eq('id', c.id);
    if (error) return NextResponse.json({ error: 'stamp_failed', detail: error.message }, { status: 502 });
    return NextResponse.json({ ok: true, sent: text, to: c.forward_to, accountCreated: created });
  }
  if (b.action === 'called') patch.pitch_called_at = now.toISOString();
  if (b.action === 'result') { patch.pitch_result = b.result ?? null; if (b.notes != null) patch.pitch_notes = b.notes; }
  patch.updated_at = now.toISOString();
  const { error } = await supabaseAdmin.from('geo_industry_campaigns').update(patch).eq('id', c.id);
  if (error) return NextResponse.json({ error: 'stamp_failed', detail: error.message }, { status: 502 });
  return NextResponse.json({ ok: true });
}
