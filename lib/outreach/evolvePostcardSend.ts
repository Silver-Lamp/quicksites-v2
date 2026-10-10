// lib/outreach/evolvePostcardSend.ts
//
// Select + mail the Evolve postcards (lib/outreach/evolvePostcard.ts). Same shape and gates as
// the trade-site claim-card loop (claimPostcardSend.ts): Lob configured, mail enabled, a real
// key for real sends, a sender a prospect can reach, a preflight of the page the card points at,
// idempotent per prospect, `postcard_sent_at` stamped only after Lob accepts.
//
// Who is eligible — all of these, none of them optional:
//   restaurant · has a website · ordering platform is none / a shop / a delivery app only ·
//   a built draft WITH A MENU · no operational claim in the draft · a street address · unmailed.
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getSenderProfile, senderProfileReady } from '@/lib/outreach/senderProfile';
import { resolveCampaignBrand, defaultOutreachOrgSlug } from '@/lib/outreach/campaignBrand';
import { sendPostcard, parseUsAddress, postcardMailEnabled, lobConfigured, lobKeyIsTest, MAX_POSTCARD_PIECES_PER_SEND } from '@/lib/outreach/mail/lob';
import { recordMailing } from '@/lib/outreach/mail/mailings';
import { getTestRecipient } from '@/lib/outreach/mail/testRecipient';
import { markOutreachSent, type Prospect } from '@/lib/outreach/prospects';
import { tradeSiteBaseUrl } from '@/lib/tradeSites/config';
import { draftHasOperationalClaims } from '@/lib/outreach/claimPostcard';
import { preflightSiteUrl, type SendReport, type SendResult } from '@/lib/outreach/claimPostcardSend';
import { draftHasMenu } from '@/lib/evolve/evolve';
import { looksLikeFoodBusiness } from '@/lib/prospects/orderingSegments';
import { SHOP, THIRD_PARTY } from '@/lib/prospects/orderingDetect';
import { buildEvolvePostcardModel, renderEvolvePostcardFront, renderEvolvePostcardBack } from './evolvePostcard';

export type EvolveMailable = {
  prospect: Prospect & { postcard_sent_at: string | null; ordering_platform: string | null; categories: string[] | null };
  templateId: string;
  slug: string;
  /** The page the card points at (preflighted before print). */
  evolveUrl: string;
  blocked?: 'no_menu' | 'operational_claims' | 'not_food' | 'no_address';
};

export const EVOLVE_ELIGIBLE_PLATFORMS: ReadonlySet<string> = new Set(['none', ...SHOP, ...THIRD_PARTY]);

export async function selectEvolveMailable(opts: { city?: string | null; region?: string | null; limit?: number } = {}): Promise<EvolveMailable[]> {
  let q = supabaseAdmin
    .from('outreach_prospects')
    .select('id, created_at, place_id, business_name, phone, address, address_lat, address_lon, city, region, industry_key, categories, website, freshness_score, freshness_signals, lead_tier, status, template_id, geo_campaign_id, waitlist_status, sweep_id, rating, review_count, postcard_sent_at, ordering_platform')
    .eq('industry_key', 'restaurant')
    .eq('status', 'draft_built')
    .not('template_id', 'is', null)
    .not('website', 'is', null)
    .neq('website', '')
    .is('postcard_sent_at', null)
    .order('review_count', { ascending: false, nullsFirst: false })
    .limit(opts.limit ?? 100);
  if (opts.city) q = q.ilike('city', opts.city);
  if (opts.region) q = q.ilike('region', opts.region);
  const { data, error } = await q;
  if (error) throw new Error(`selectEvolveMailable: ${error.message}`);
  const rows = ((data ?? []) as EvolveMailable['prospect'][]).filter((p) => EVOLVE_ELIGIBLE_PLATFORMS.has(p.ordering_platform ?? ''));
  const ids = rows.map((r) => r.template_id).filter((x): x is string => !!x);
  const { data: tpls } = ids.length ? await supabaseAdmin.from('templates').select('id, slug, data').in('id', ids) : { data: [] as any[] };
  const byId = new Map<string, { slug: string | null; data: unknown }>();
  for (const t of (tpls ?? []) as Array<{ id: string; slug: string | null; data: unknown }>) byId.set(t.id, { slug: t.slug, data: t.data });
  const base = tradeSiteBaseUrl();
  const out: EvolveMailable[] = [];
  for (const p of rows) {
    const t = p.template_id ? byId.get(p.template_id) : null;
    if (!t?.slug) continue;
    const item: EvolveMailable = { prospect: p, templateId: p.template_id!, slug: t.slug, evolveUrl: `${base.replace(/\/+$/, '')}/evolve/${p.id}` };
    if (!looksLikeFoodBusiness(p.categories)) item.blocked = 'not_food';
    else if (!p.address?.trim()) item.blocked = 'no_address';
    else if (!draftHasMenu(t.data)) item.blocked = 'no_menu';
    else if (draftHasOperationalClaims(t.data)) item.blocked = 'operational_claims';
    out.push(item);
  }
  return out;
}

export async function renderEvolvePostcardFor(d: EvolveMailable) {
  const senderProfile = await getSenderProfile();
  const brand = await resolveCampaignBrand(null);
  const orgSlug = defaultOutreachOrgSlug();
  const model = await buildEvolvePostcardModel({
    prospect: d.prospect,
    senderProfile,
    brandName: orgSlug ? brand.name : null,
    supportEmail: brand.supportEmail,
    baseUrl: orgSlug ? brand.baseUrl : tradeSiteBaseUrl(),
  });
  return { model, frontHtml: renderEvolvePostcardFront(model), backHtml: renderEvolvePostcardBack(model) };
}

export async function sendEvolvePostcards(opts: { drafts: EvolveMailable[]; sentBy: string | null; test?: boolean; max?: number }): Promise<SendReport> {
  const report: SendReport = { attempted: 0, mailed: 0, blocked: 0, failed: 0, results: [] };
  if (!lobConfigured()) return { ...report, reason: 'lob_not_configured' };
  if (!postcardMailEnabled()) return { ...report, reason: 'postcard_mail_disabled' };
  if (!opts.test && lobKeyIsTest()) return { ...report, reason: 'lob_test_key' };
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
      const live = await preflightSiteUrl(d.evolveUrl);
      if (!live.ok) {
        report.failed++;
        report.results.push({ prospectId: p.id, businessName: p.business_name, ok: false, error: `evolve_page_not_reachable:${live.status}${live.detail ? `:${live.detail}` : ''}` });
        continue;
      }
      const { frontHtml, backHtml } = await renderEvolvePostcardFor(d);
      const r = await sendPostcard({
        to,
        frontHtml,
        backHtml,
        description: `${opts.test ? '[TEST] ' : ''}Evolve card ${d.slug}`,
        metadata: { prospect_id: p.id, template_id: d.templateId, kind: 'evolve', ...(opts.test ? { test: '1' } : {}) },
        idempotencyKey: opts.test ? `test_evolve_${p.id}_${Date.now()}` : `evolve_${p.id}`,
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
      const ok: SendResult = { prospectId: p.id, businessName: p.business_name, ok: true, lobId: r.id, expectedDelivery: r.expectedDeliveryDate };
      report.results.push(ok);
    } catch (e: any) {
      report.failed++;
      console.warn(`[evolve-postcards] ${opts.test ? 'test ' : ''}send failed for ${d.slug} (${p.business_name}): ${e?.message || e}`);
      report.results.push({ prospectId: p.id, businessName: p.business_name, ok: false, error: e?.message || 'send_failed' });
    }
    if (opts.test) break;
  }
  if (mailedIds.length) await markOutreachSent(mailedIds, 'postcard');
  return report;
}
