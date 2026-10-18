// lib/ppl/pitchSend.ts — the one way a pitch text is sent, used by the operator's button AND the
// hourly cron, so the two can never drift (the sweep-button/cron lesson, CLAUDE.md §5b).
//
// Text 1: the account is created PENDING if none (the campaign flips to pay-per-call only when
// the deposit lands — lib/ppl/billing.ts), the deposit link is minted, the text goes to the
// forward-to, the funnel is stamped. Text 2: the real alternative shop (or none) decides the
// wording. Never the caller; STOP honoured; every send recorded with who sent it.
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getGeoCampaign, type GeoCampaign } from '@/lib/outreach/geoCampaigns';
import { getPplAccountByCampaign, createPplAccount, type PplAccount } from '@/lib/ppl/accounts';
import { createDepositCheckout } from '@/lib/ppl/billing';
import { isOptedOut } from '@/lib/ppl/forwardNotice';
import { sendSms } from '@/lib/sms/sendSms';
import { publicBaseUrl } from '@/lib/outreach/competitionPoster';
import { DEALS, usd, type DealKey } from '@/lib/ppl/pitchPlan';
import { PPL_DEFAULTS } from '@/lib/ppl/rules';
import { pitchText1, pitchText2, type PitchFunnel } from '@/lib/ppl/pitchText';
import { last10 } from '@/lib/ppl/ownNumberCall';
import { classifyDial } from '@/lib/ppl/forwardHealth';

export type PitchCampaign = GeoCampaign & Partial<Record<'pitch_deal' | 'pitch_texted_at' | 'pitch_followup_at' | 'pitch_followup_kind' | 'pitch_repoint_prospect_id' | 'pitch_repoint_by' | 'pitch_called_at' | 'pitch_result' | 'pitch_notes' | 'pitch_sent_by' | 'pitch_intervene_emailed_at' | 'pitch_paid_emailed_at', string | null>>;

export type SentBy = 'operator' | 'cron';

export function funnelOf(c: PitchCampaign): PitchFunnel {
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

/** The latest customer-read (or unread), ≥floor call the business took — what text 1 names. */
export async function latestLead(campaignId: string): Promise<{ at: string; seconds: number; callerPhone: string | null } | null> {
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
export async function alternativeShop(c: PitchCampaign): Promise<{ id: string; name: string; phone: string } | null> {
  if (!c?.city || !c.industry_key) return null;
  const { data } = await supabaseAdmin
    .from('outreach_prospects')
    .select('id, business_name, phone, rating, review_count')
    .eq('region', c.region ?? 'WA')
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

export async function depositLink(c: PitchCampaign, dealKey: DealKey, businessName: string): Promise<{ url: string; created: boolean; account: PplAccount }> {
  let account = await getPplAccountByCampaign(c.id);
  let created = false;
  if (!account) {
    const d = DEALS[dealKey];
    account = await createPplAccount({ geo_campaign_id: c.id, business_name: businessName, contact_phone: c.forward_to ?? null, cpl_cents: d.cplCents, min_billable_seconds: PPL_DEFAULTS.minBillableSeconds, reload_threshold_cents: d.reloadThresholdCents, reload_amount_cents: d.reloadAmountCents, auto_reload: true });
    created = true;
  }
  const checkout = await createDepositCheckout(account, DEALS[dealKey].depositCents);
  return { url: checkout.url, created, account };
}

export type SendResult = { ok: true; text: string; to: string; accountCreated: boolean; kind?: 'repoint' | 'last_free'; alternative?: { id: string; name: string } | null; by?: string | null } | { ok: false; error: string; detail?: string | null };

async function guard(c: PitchCampaign): Promise<SendResult | null> {
  if (!c.forward_to) return { ok: false, error: 'no_forward_to' };
  if (await isOptedOut(c.forward_to).catch(() => false)) return { ok: false, error: 'opted_out' };
  return null;
}

export async function sendPitchText1(campaignId: string, opts: { dealKey?: DealKey; by: SentBy }): Promise<SendResult> {
  const c = (await getGeoCampaign(campaignId).catch(() => null)) as PitchCampaign | null;
  if (!c) return { ok: false, error: 'not_found' };
  const g = await guard(c); if (g) return g;
  if (c.pitch_texted_at) return { ok: false, error: 'already_texted' };
  const dealKey: DealKey = opts.dealKey ?? (funnelOf(c).deal as DealKey | null) ?? 'next';
  const business = c.forward_to_name || 'the business on the line';
  const { url, created } = await depositLink(c, dealKey, business);
  const lead = await latestLead(c.id);
  const text = pitchText1({ domain: c.domain, lead, deal: dealKey, checkoutUrl: url, termsUrl: `${publicBaseUrl()}/leads/terms` });
  const r = await sendSms(c.forward_to!, text);
  if (!r.ok) return { ok: false, error: 'send_failed', detail: r.error ?? null };
  const now = new Date().toISOString();
  await supabaseAdmin.from('geo_industry_campaigns').update({ pitch_texted_at: now, pitch_deal: dealKey, pitch_sent_by: opts.by, updated_at: now }).eq('id', c.id).is('pitch_texted_at', null);
  return { ok: true, text, to: c.forward_to!, accountCreated: created };
}

export async function sendPitchText2(campaignId: string, opts: { by: SentBy }): Promise<SendResult> {
  const c = (await getGeoCampaign(campaignId).catch(() => null)) as PitchCampaign | null;
  if (!c) return { ok: false, error: 'not_found' };
  const g = await guard(c); if (g) return g;
  if (!c.pitch_texted_at) return { ok: false, error: 'text1_not_sent' };
  if (c.pitch_followup_at) return { ok: false, error: 'already_followed_up' };
  const dealKey: DealKey = (funnelOf(c).deal as DealKey | null) ?? 'next';
  const business = c.forward_to_name || 'the business on the line';
  const { url } = await depositLink(c, dealKey, business);
  const alt = await alternativeShop(c);
  const now = new Date();
  const t2 = pitchText2({ domain: c.domain, deal: dealKey, checkoutUrl: url, alternative: alt ? { name: alt.name } : null, sentAt: now });
  const r = await sendSms(c.forward_to!, t2.text);
  if (!r.ok) return { ok: false, error: 'send_failed', detail: r.error ?? null };
  await supabaseAdmin.from('geo_industry_campaigns').update({
    pitch_followup_at: now.toISOString(), pitch_followup_kind: t2.kind, pitch_repoint_prospect_id: alt?.id ?? null,
    pitch_repoint_by: t2.by ? t2.by.toISOString().slice(0, 10) : null, updated_at: now.toISOString(),
  }).eq('id', c.id).is('pitch_followup_at', null);
  return { ok: true, text: t2.text, to: c.forward_to!, accountCreated: false, kind: t2.kind, alternative: alt ? { id: alt.id, name: alt.name } : null, by: t2.by ? t2.by.toISOString().slice(0, 10) : null };
}

export async function resendPitchLink(campaignId: string, opts: { dealKey?: DealKey }): Promise<SendResult> {
  const c = (await getGeoCampaign(campaignId).catch(() => null)) as PitchCampaign | null;
  if (!c) return { ok: false, error: 'not_found' };
  const g = await guard(c); if (g) return g;
  const dealKey: DealKey = opts.dealKey ?? (funnelOf(c).deal as DealKey | null) ?? 'next';
  const { url, created } = await depositLink(c, dealKey, c.forward_to_name || 'the business on the line');
  const d = DEALS[dealKey];
  const text = `QuickSites: here is the link again for ${c.domain} — ${dealKey === 'next' ? `${usd(d.cplCents)} for the next call, then ${usd(d.cplCents)} as each one comes in` : `${d.leads} calls for ${usd(d.depositCents)}`}: ${url} Reply STOP to stop.`;
  const r = await sendSms(c.forward_to!, text);
  if (!r.ok) return { ok: false, error: 'send_failed', detail: r.error ?? null };
  if (!funnelOf(c).deal) await supabaseAdmin.from('geo_industry_campaigns').update({ pitch_deal: dealKey, updated_at: new Date().toISOString() }).eq('id', c.id);
  return { ok: true, text, to: c.forward_to!, accountCreated: created };
}

/**
 * What the cron should do with one line right now. Pure, so the order of checks is a test:
 * paid wins over everything; a date we promised and did not keep is the owner's to act on (the
 * cron NEVER re-points — nobody is pointed at without a person dialling them first); text 1 only
 * for a line with a paid-grade lead; text 2 only after the wait, and only while nothing landed.
 */
export type AutoDecision =
  | { action: 'mark_paid' }
  | { action: 'intervene_repoint'; by: string }
  | { action: 'text1' }
  | { action: 'text2' }
  | { action: 'wait'; reason: 'followup_not_due' | 'awaiting_call' | 'already_done' | 'no_lead' | 'result_recorded' };

export function pitchAutoDecision(args: { funnel: PitchFunnel; hasPaidGradeLead: boolean; accountActive: boolean; nowMs: number; followupAfterDays: number }): AutoDecision {
  const f = args.funnel;
  if (args.accountActive && f.result !== 'paid') return { action: 'mark_paid' };
  if (f.result) return { action: 'wait', reason: 'result_recorded' };
  if (!f.textedAt) return args.hasPaidGradeLead ? { action: 'text1' } : { action: 'wait', reason: 'no_lead' };
  if (!f.followupAt) {
    const days = (args.nowMs - Date.parse(f.textedAt)) / 86_400_000;
    return days >= args.followupAfterDays ? { action: 'text2' } : { action: 'wait', reason: 'followup_not_due' };
  }
  if (f.followupKind === 'repoint' && f.repointBy && args.nowMs >= Date.parse(`${f.repointBy}T23:59:59Z`)) return { action: 'intervene_repoint', by: f.repointBy };
  return { action: 'wait', reason: f.calledAt ? 'already_done' : 'awaiting_call' };
}
