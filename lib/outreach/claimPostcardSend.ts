// lib/outreach/claimPostcardSend.ts
//
// Select the drafts a claim postcard can go to, and mail them. Shared by the admin route
// (preview / test / send) and the nightly pipeline's mail step, so a card the cron mails is the
// card the operator previewed.
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getSenderProfile, senderProfileReady } from '@/lib/outreach/senderProfile';
import { resolveCampaignBrand, defaultOutreachOrgSlug } from '@/lib/outreach/campaignBrand';
import { sendPostcard, parseUsAddress, postcardMailEnabled, lobConfigured, MAX_POSTCARD_PIECES_PER_SEND } from '@/lib/outreach/mail/lob';
import { recordMailing } from '@/lib/outreach/mail/mailings';
import { getTestRecipient } from '@/lib/outreach/mail/testRecipient';
import { markOutreachSent, type Prospect } from '@/lib/outreach/prospects';
import { publicSiteUrl } from '@/lib/sites/publicUrl';
import { tradeSiteBaseUrl } from '@/lib/tradeSites/config';
import { buildClaimPostcardModel, renderClaimPostcardFront, renderClaimPostcardBack, isMailableProspect, draftHasOperationalClaims } from './claimPostcard';

const db = () => supabaseAdmin as any;

export type MailableDraft = {
  prospect: Prospect & { postcard_sent_at: string | null };
  templateId: string;
  slug: string;
  siteUrl: string;
  builtAt: string;
  /** Why this one will NOT be mailed, or null when it can be. */
  blocked: 'operational_claims' | 'unparseable_address' | 'not_a_listing_draft' | null;
};

export type SelectOptions = { city?: string | null; region?: string | null; industry?: string | null; limit?: number; minAgeHours?: number };

/** Every built, unmailed, no-website trade draft — with the reason any of them is blocked. */
export async function selectMailableDrafts(opts: SelectOptions = {}): Promise<MailableDraft[]> {
  let q = db()
    .from('outreach_prospects')
    .select('id, created_at, place_id, business_name, phone, address, address_lat, address_lon, city, region, industry_key, categories, website, freshness_score, freshness_signals, lead_tier, status, template_id, geo_campaign_id, waitlist_status, sweep_id, rating, review_count, postcard_sent_at')
    .eq('status', 'draft_built')
    .eq('lead_tier', 'no_website')
    .is('postcard_sent_at', null)
    .not('template_id', 'is', null)
    .neq('industry_key', 'restaurant')
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(opts.limit ?? 200, 1), 500));
  if (opts.city) q = q.ilike('city', opts.city);
  if (opts.region) q = q.ilike('region', opts.region);
  if (opts.industry) q = q.eq('industry_key', opts.industry);
  const { data, error } = await q;
  if (error) throw new Error(`selectMailableDrafts: ${error.message}`);
  const prospects = ((data ?? []) as MailableDraft['prospect'][]).filter(isMailableProspect);
  if (!prospects.length) return [];

  const ids = prospects.map((p) => p.template_id!);
  const { data: tpls, error: tErr } = await db()
    .from('templates')
    .select('id, slug, custom_domain, claim_source, owner_id, created_at, data')
    .in('id', ids);
  if (tErr) throw new Error(`selectMailableDrafts templates: ${tErr.message}`);
  const byId = new Map<string, any>((tpls ?? []).map((t: any) => [t.id, t]));
  const cutoff = opts.minAgeHours ? Date.now() - opts.minAgeHours * 3600_000 : null;

  const out: MailableDraft[] = [];
  for (const p of prospects) {
    const t = byId.get(p.template_id!);
    if (!t) continue;
    if (cutoff && new Date(t.created_at).getTime() > cutoff) continue; // too fresh for the cron
    const siteUrl = publicSiteUrl({ custom_domain: t.custom_domain, slug: t.slug });
    if (!siteUrl) continue;
    let blocked: MailableDraft['blocked'] = null;
    if (t.claim_source !== 'listing_import') blocked = 'not_a_listing_draft';
    else if (draftHasOperationalClaims(t.data)) blocked = 'operational_claims';
    else if (!parseUsAddress(p.address, p.city, p.region)) blocked = 'unparseable_address';
    out.push({ prospect: p, templateId: t.id, slug: t.slug, siteUrl, builtAt: t.created_at, blocked });
  }
  return out;
}

export type SendResult = { prospectId: string; businessName: string; ok: boolean; lobId?: string; expectedDelivery?: string | null; skipped?: string; error?: string };

export type SendOptions = {
  drafts: MailableDraft[];
  sentBy: string | null;
  /** Mail exactly one real card to the configured test address instead of the prospects. */
  test?: boolean;
  max?: number;
};

export type SendReport = { attempted: number; mailed: number; blocked: number; failed: number; results: SendResult[]; reason?: string };

/** Render one draft's card (for preview and for send). */
export async function renderClaimPostcardFor(d: MailableDraft) {
  const senderProfile = await getSenderProfile();
  const brand = await resolveCampaignBrand(null);
  const orgSlug = defaultOutreachOrgSlug();
  const model = await buildClaimPostcardModel({
    prospect: d.prospect,
    siteUrl: d.siteUrl,
    senderProfile,
    // A branded (reseller) default org signs as the team; the platform default signs as a person.
    brandName: orgSlug ? brand.name : null,
    supportEmail: brand.supportEmail,
    // A branded org prints its own host; the platform default prints www.quicksites.ai — never
    // publicBaseUrl(), which rendered delivered.menu on an auto shop's card once (see config.ts).
    baseUrl: orgSlug ? brand.baseUrl : tradeSiteBaseUrl(),
  });
  return { model, frontHtml: renderClaimPostcardFront(model), backHtml: renderClaimPostcardBack(model) };
}

/**
 * Mail the cards. Refuses, with a reason, when Lob is unconfigured, postcard mail is off, or the
 * sender profile has no name + email (a prospect must be able to reach a human). Blocked drafts
 * are counted, never mailed. Real sends are idempotent per prospect; test sends are not.
 */
export async function sendClaimPostcards(opts: SendOptions): Promise<SendReport> {
  const report: SendReport = { attempted: 0, mailed: 0, blocked: 0, failed: 0, results: [] };
  if (!lobConfigured()) return { ...report, reason: 'lob_not_configured' };
  if (!postcardMailEnabled()) return { ...report, reason: 'postcard_mail_disabled' };
  const profile = await getSenderProfile();
  if (!opts.test && !senderProfileReady(profile)) return { ...report, reason: 'sender_profile_incomplete' };
  const testTo = opts.test ? await getTestRecipient() : null;
  if (opts.test && !testTo) return { ...report, reason: 'no_test_recipient' };

  const max = Math.min(opts.max ?? MAX_POSTCARD_PIECES_PER_SEND, MAX_POSTCARD_PIECES_PER_SEND);
  const mailedIds: string[] = [];
  for (const d of opts.drafts) {
    if (report.mailed >= max) break;
    const p = d.prospect;
    if (d.blocked) {
      report.blocked++;
      report.results.push({ prospectId: p.id, businessName: p.business_name, ok: false, skipped: d.blocked });
      continue;
    }
    report.attempted++;
    const to = opts.test
      ? { name: p.business_name, line1: testTo!.line1, city: testTo!.city, state: testTo!.state, zip: testTo!.zip }
      : (() => { const a = parseUsAddress(p.address, p.city, p.region); return a ? { name: p.business_name, ...a } : null; })();
    if (!to) {
      report.failed++;
      report.results.push({ prospectId: p.id, businessName: p.business_name, ok: false, error: 'unparseable_address' });
      continue;
    }
    try {
      const { frontHtml, backHtml } = await renderClaimPostcardFor(d);
      const r = await sendPostcard({
        to,
        frontHtml,
        backHtml,
        description: `${opts.test ? '[TEST] ' : ''}Trade-site claim card ${d.slug}`,
        metadata: { prospect_id: p.id, template_id: d.templateId, kind: 'trade_claim', ...(opts.test ? { test: '1' } : {}) },
        idempotencyKey: opts.test ? `test_claim_${p.id}_${Date.now()}` : `claim_${p.id}`,
      });
      report.mailed++;
      if (!opts.test) mailedIds.push(p.id);
      try {
        await recordMailing({
          lobId: r.id, prospectId: p.id, campaignId: null, sentBy: opts.sentBy,
          toName: to.name, toAddress: `${to.line1}, ${to.city}, ${to.state} ${to.zip}`,
          expectedDeliveryDate: r.expectedDeliveryDate, carrier: r.carrier, trackingNumber: r.trackingNumber,
          thumbnailUrl: r.thumbnailUrl, pdfUrl: r.pdfUrl,
        });
      } catch { /* tracking is best-effort */ }
      report.results.push({ prospectId: p.id, businessName: p.business_name, ok: true, lobId: r.id, expectedDelivery: r.expectedDeliveryDate });
    } catch (e: any) {
      report.failed++;
      report.results.push({ prospectId: p.id, businessName: p.business_name, ok: false, error: e?.message || 'send_failed' });
    }
    if (opts.test) break;
  }
  if (mailedIds.length) await markOutreachSent(mailedIds, 'postcard');
  return report;
}
