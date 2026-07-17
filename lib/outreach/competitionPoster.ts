// lib/outreach/competitionPoster.ts
//
// The "first to claim boston-towing.com wins" competition poster — the modern,
// industry-driven successor to the towing-hardcoded ClaimPoster. One source of truth
// for both the printable on-screen poster AND the Lob postcard artwork: renderPosterHtml
// returns a self-contained HTML doc, and the QR encodes the TOKENIZED claim link
// (/claim-site/<pitchId>?token=…), so scanning goes straight to preview + one-tap claim.

import QRCode from 'qrcode';
import { mintSiteClaimToken } from '@/lib/auth/siteClaimToken';
import { KEY_TO_LABEL, type IndustryKey } from '@/lib/industries';
import type { GeoCampaign } from '@/lib/outreach/geoCampaigns';
import type { Prospect } from '@/lib/outreach/prospects';
import { getSenderProfile, type SenderProfile } from '@/lib/outreach/senderProfile';

export function publicBaseUrl(): string {
  return (
    process.env.APP_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.QS_PUBLIC_URL ||
    'https://quicksites.ai'
  ).replace(/\/+$/, '');
}

/** The tokenized claim link for a pitch site — whoever signs up through it owns it.
 *  Pass `base` (an org's branded host) to serve the link on that domain instead of quicksites.ai. */
export function claimUrlFor(templateId: string, base: string = publicBaseUrl()): string {
  return `${base.replace(/\/+$/, '')}/claim-site/${templateId}?token=${encodeURIComponent(mintSiteClaimToken(templateId))}`;
}

/**
 * A tracked claim link (poster/SMS/postcard) — logs a visit, then redirects to claimUrlFor.
 * Pass a prospectId for a per-recipient link (`/r/<campaign>?p=<prospect>`), so a scan
 * attributes to the specific business that was mailed rather than just the campaign.
 * Pass `base` (an org's branded host) to brand the domain prospects see.
 */
export function trackedClaimUrl(campaignId: string, prospectId?: string | null, base: string = publicBaseUrl()): string {
  const q = prospectId ? `?p=${encodeURIComponent(prospectId)}` : '';
  return `${base.replace(/\/+$/, '')}/r/${campaignId}${q}`;
}

/** QR data-URL for an arbitrary link (per-prospect postcard QR is generated in the send loop). */
export async function qrDataUrlFor(url: string): Promise<string> {
  return QRCode.toDataURL(url, { width: 480, margin: 1, errorCorrectionLevel: 'M' });
}

/** A real human sign-off for the postcard back — face + signature + name beat a logo for
 *  cold trust ("a real person built this," not a scam). Resolved from env for the default
 *  brand; suppressed for reseller/owning-org sends so we never stamp our operator on a
 *  partner's card (they keep the "— The {brand} team" line instead). */
export type PostcardSender = {
  name: string;
  title?: string | null;
  /** "Questions? {email}" — printed on the card so a prospect can reach a human. */
  email?: string | null;
  /** Remote or data URL — Lob fetches remote images when it renders the HTML. */
  headshotUrl?: string | null;
  signatureUrl?: string | null;
};

export type PosterModel = {
  domain: string;
  industryLabel: string;
  city: string;
  region: string | null;
  businesses: string[];
  claimUrl: string;
  qrDataUrl: string;
  /** The specific business this piece is mailed to — highlighted in the list + greeted on the back. */
  recipientName?: string | null;
  /** A concrete claim deadline (e.g. "Jul 26"), rendered instead of the vague "72-hour" badge. */
  deadline?: string | null;
  /** Owning-org brand shown as "Built by {brandName}" (defaults to no wordmark = QuickSites). */
  brandName?: string | null;
  /** 3 concrete benefit bullets on the back — what the site DOES, so the offer isn't only scarcity. */
  benefits?: string[];
  /** Personal human sign-off on the back (headshot + signature + name). */
  sender?: PostcardSender | null;
  /** "{City}, {ST}" of the sender's business, shown ONLY when local to the target (same state
   *  or within radius) — the "oh, they're local to me" trust reflex. Null when not local. */
  localLine?: string | null;
  /** Restaurant domain-competition: the domain is a diner-traffic PRIZE won by claiming the
   *  restaurant's own ordering site, not the site itself. Switches the copy to that framing. */
  restaurantComp?: boolean;
};

/**
 * Three concrete benefit bullets for the postcard back, tuned to the vertical — the site's
 * value in the prospect's terms, so the card sells "start taking orders," not just "claim a
 * domain." Kept to three short lines: a postcard converts on one idea, not a feature list.
 */
export function postcardBenefits(industry: IndustryKey): string[] {
  const FOOD = new Set<IndustryKey>(['restaurant']);
  const RETAIL_MAKER = new Set<IndustryKey>([
    'retail_boutique', 'retail_home_goods', 'retail_electronics', 'retail_thrift',
    'crafts', 'handmade', 'etsy_style', 'gifts_stationery', 'artisan_goods', 'art_supplies',
    'antiques_vintage', 'collectibles', 'pet_boutique', 'pop_up_shop', 'farmers_market_vendor',
    'online_reseller', 'print_on_demand', 'custom_apparel', 'author',
  ]);
  if (FOOD.has(industry)) {
    return [
      'Customers order online right from their phone',
      'Your full menu, always current — edit it anytime',
      'Show up on Google when locals search nearby',
    ];
  }
  if (RETAIL_MAKER.has(industry)) {
    return [
      'Sell your products online — no storefront needed',
      'Secure checkout, you keep the sale',
      'Found on Google when locals search nearby',
    ];
  }
  // Estimator-trade verticals — the free instant estimate is the hook that turns a
  // browsing homeowner into a priced lead (all 9 trades live on the DeckSketch endpoint).
  const ESTIMATOR_TRADES = new Set<IndustryKey>([
    'deck_builder', 'fencing', 'concrete', 'turf', 'epoxy_flooring', 'paving', 'roofing', 'siding', 'retaining_walls',
  ]);
  if (ESTIMATOR_TRADES.has(industry)) {
    return [
      'A free instant estimate turns visitors into real leads',
      'Homeowners get a ballpark price on the spot — before they call',
      'Found on Google when locals search for you nearby',
    ];
  }
  return [
    'Customers find you first when they search Google',
    'Request a quote or call you in one tap',
    'Live in minutes — nothing to install or maintain',
  ];
}

/**
 * The human sign-off for the postcard back, from the operator's saved sender profile. Returns
 * null for reseller/owning-org sends (a non-null `brandName`) — their card keeps the
 * "— The {brand} team" line and never carries the platform operator's face — or when the
 * profile has no name yet.
 */
export function senderFromProfile(profile: SenderProfile, brandName?: string | null): PostcardSender | null {
  if (brandName) return null;
  if (!profile.name) return null;
  return {
    name: profile.name,
    title: profile.title,
    email: profile.email,
    headshotUrl: profile.headshotUrl,
    signatureUrl: profile.signatureUrl,
  };
}

/** Great-circle distance in miles between two lat/lng points. */
function haversineMiles(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 3958.8; // earth radius, miles
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/**
 * The sender's "{City}, {ST}" line, returned ONLY when the sender is local to the target — same
 * state, or within `radiusMiles` (default 300) when both ends have coordinates. Null otherwise,
 * so a far-away sender never fakes a local pretense. Pure + exported for tests.
 */
export function resolveLocalityLine(opts: {
  senderCity: string | null;
  senderState: string | null;
  senderLat: number | null;
  senderLng: number | null;
  targetState: string | null;
  targetLat: number | null;
  targetLng: number | null;
  radiusMiles?: number;
}): string | null {
  const { senderCity, senderState } = opts;
  if (!senderCity || !senderState) return null;
  const label = `${senderCity}, ${senderState}`;
  const norm = (s: string) => s.trim().toLowerCase();
  // Same-state is the strongest, simplest "local to me" signal.
  if (opts.targetState && norm(opts.targetState) === norm(senderState)) return label;
  // Otherwise fall back to a great-circle radius when both ends have coordinates.
  const r = opts.radiusMiles && opts.radiusMiles > 0 ? opts.radiusMiles : 300;
  if (opts.senderLat != null && opts.senderLng != null && opts.targetLat != null && opts.targetLng != null) {
    if (haversineMiles(opts.senderLat, opts.senderLng, opts.targetLat, opts.targetLng) <= r) return label;
  }
  return null;
}

/** Format a claim deadline `days` out from now as a short "Mon D" (US), for postcard urgency. */
export function claimDeadlineLabel(days = 14, from: Date = new Date()): string {
  const d = new Date(from.getTime() + days * 86_400_000);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export async function buildPosterModel(
  campaign: GeoCampaign,
  prospects: Prospect[],
  opts?: { baseUrl?: string; brandName?: string | null },
): Promise<PosterModel | null> {
  // Restaurant competitions have no shared pitch site (each restaurant has its own
  // delivered.menu site) — they're still postcard-able; the personalized send below
  // regenerates a per-prospect tracked claim link. Services campaigns still require a
  // pitch site.
  const isRestaurantComp = campaign.kind === 'restaurant_competition'; // RESTAURANT_COMPETITION_KIND
  if (!campaign.template_id && !isRestaurantComp) return null;
  // Tracked link so a poster/postcard scan registers as a claim-intent visit — on the
  // owning org's branded domain when one is provided. For a restaurant competition the
  // generic (non-personalized) poster points at the apex DIRECTORY instead.
  const claimUrl = isRestaurantComp
    ? `https://${campaign.domain}`
    : trackedClaimUrl(campaign.id, null, opts?.baseUrl);
  const qrDataUrl = await QRCode.toDataURL(claimUrl, { width: 480, margin: 1, errorCorrectionLevel: 'M' });
  const brandName = opts?.brandName ?? null;
  const industry = campaign.industry_key as IndustryKey;
  // Operator's saved sender identity (DB profile, env fallback) — drives the human sign-off,
  // contact email, and the local-proximity signal.
  const profile = await getSenderProfile();
  // Local-proximity signal: use any prospect's coords as the campaign's location (a geo
  // campaign targets one city, so they cluster).
  const target = prospects.find((p) => p.address_lat != null && p.address_lon != null);
  const localLine = resolveLocalityLine({
    senderCity: profile.city,
    senderState: profile.state,
    senderLat: profile.lat,
    senderLng: profile.lng,
    targetState: campaign.region,
    targetLat: target?.address_lat ?? null,
    targetLng: target?.address_lon ?? null,
    radiusMiles: Number(process.env.POSTCARD_LOCAL_RADIUS_MILES) || 300,
  });
  return {
    domain: campaign.domain,
    industryLabel: KEY_TO_LABEL[industry] ?? 'Local Services',
    city: campaign.city,
    region: campaign.region,
    businesses: prospects.map((p) => p.business_name),
    claimUrl,
    qrDataUrl,
    brandName,
    benefits: postcardBenefits(industry),
    sender: senderFromProfile(profile, brandName),
    localLine,
    restaurantComp: isRestaurantComp,
  };
}

/**
 * Render the exact per-recipient postcard (front + back) that gets mailed — one source of
 * truth for both the paid send loop AND the pre-send preview, so what an operator previews
 * is byte-for-byte what Lob prints. Regenerates the per-prospect tracked QR.
 */
export async function renderPersonalizedPostcard(
  model: PosterModel,
  opts: { campaignId: string; prospectId: string; recipientName: string; deadline?: string | null; baseUrl?: string },
): Promise<{ frontHtml: string; backHtml: string; claimUrl: string }> {
  const claimUrl = trackedClaimUrl(opts.campaignId, opts.prospectId, opts.baseUrl);
  const pModel: PosterModel = {
    ...model,
    claimUrl,
    qrDataUrl: await qrDataUrlFor(claimUrl),
    recipientName: opts.recipientName,
    deadline: opts.deadline ?? null,
  };
  return { frontHtml: renderPosterHtml(pModel), backHtml: renderPosterBackHtml(pModel), claimUrl };
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
}

/**
 * Full self-contained HTML doc for one competition poster (~6×9 postcard proportions).
 * Inline styles only (no external assets) so it renders identically in the admin print
 * view AND when handed to Lob as postcard front HTML.
 */
export function renderPosterHtml(m: PosterModel): string {
  const place = m.region ? `${m.city}, ${m.region}` : m.city;
  const norm = (s: string) => s.trim().toLowerCase();
  const recip = m.recipientName ? norm(m.recipientName) : null;
  // Put the recipient first and flag it, so the card reads as "you're in this race".
  const ordered = m.businesses.slice();
  if (recip) ordered.sort((a, b) => Number(norm(b) === recip) - Number(norm(a) === recip));
  const businessRows = ordered
    .slice(0, 6)
    .map((b) => {
      const you = recip && norm(b) === recip;
      return `<div class="biz${you ? ' you' : ''}">${you ? '★ ' : ''}${esc(b)}${you ? ' <span class="youtag">(you)</span>' : ''}</div>`;
    })
    .join('<div class="or">or</div>');
  const offerBadge = m.deadline ? `CLAIM BY ${esc(m.deadline).toUpperCase()}` : '72-HOUR OFFERING';

  // Restaurant competitions frame the domain as a diner-traffic PRIZE (won by claiming the
  // restaurant's own ordering site), not as the site itself.
  const headlineHtml = m.restaurantComp
    ? `Own restaurant orders<br/>in ${esc(place)}`
    : `Own ${esc(place)}<br/>${esc(m.industryLabel)} online`;
  const subHtml = m.restaurantComp
    ? `A premium address diners search — it goes to <b>one</b> restaurant.`
    : `This premium local domain is available to <b>one</b> business.`;
  const scanLabel = m.restaurantComp
    ? 'Scan to preview &amp; claim your free ordering site'
    : 'Scan to preview &amp; claim your free site';

  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html,body { background:#0b1020; }
  .poster {
    width: 6in; height: 9in; margin: 0 auto; padding: 0.5in 0.55in;
    background: radial-gradient(120% 80% at 50% 0%, #16233f 0%, #0b1020 60%);
    color: #f8fafc; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    display: flex; flex-direction: column; text-align: center;
  }
  .kicker { color:#93c5fd; letter-spacing:.14em; text-transform:uppercase; font-size:11pt; font-weight:600; }
  .headline { margin-top:.12in; font-size:26pt; font-weight:800; line-height:1.05; }
  .domain { margin-top:.16in; font-size:23pt; font-weight:800; color:#34d399; word-break:break-all; }
  .sub { margin-top:.1in; color:#cbd5e1; font-size:12.5pt; }
  .biz { margin:.04in auto; padding:.06in .16in; background:rgba(255,255,255,.06); border:1px solid rgba(148,163,184,.3); border-radius:8px; font-weight:600; font-size:12.5pt; max-width:4.4in; }
  .biz.you { background:rgba(52,211,153,.16); border-color:#34d399; color:#ecfdf5; }
  .youtag { color:#6ee7b7; font-weight:700; font-size:9.5pt; text-transform:uppercase; letter-spacing:.06em; }
  .or { color:#f59e0b; font-weight:700; font-size:10.5pt; text-transform:uppercase; letter-spacing:.1em; margin:.02in 0; }
  .competition { margin-top:.2in; }
  .qrwrap { margin-top:auto; padding-top:.2in; }
  .qr { width:2.1in; height:2.1in; background:#fff; padding:.08in; border-radius:12px; }
  .scan { margin-top:.1in; font-size:12pt; font-weight:600; }
  .offer { margin-top:.14in; display:inline-block; background:#f59e0b; color:#111; font-weight:800; font-size:11pt; padding:.06in .18in; border-radius:999px; letter-spacing:.03em; }
  .local { margin-top:.12in; display:inline-block; color:#a7f3d0; font-size:10pt; font-weight:600; letter-spacing:.02em; }
  .foot { margin-top:.12in; color:#94a3b8; font-size:9pt; word-break:break-all; }
  .brand { margin-top:.06in; color:#64748b; font-size:8.5pt; letter-spacing:.04em; }
  @media print { @page { size: 6in 9in; margin: 0; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style></head>
<body><div class="poster">
  <div class="kicker">${esc(m.city)} · ${esc(m.industryLabel)}</div>
  <div class="headline">${headlineHtml}</div>
  <div class="domain">${esc(m.domain)}</div>
  <div class="sub">${subHtml}</div>
  ${m.localLine ? `<div class="local">📍 From a local business · ${esc(m.localLine)}</div>` : ''}
  <div class="competition">
    <div class="or" style="margin-bottom:.06in">First to claim it wins</div>
    ${businessRows}
  </div>
  <div class="qrwrap">
    <img class="qr" src="${m.qrDataUrl}" alt="Scan to claim ${esc(m.domain)}" />
    <div class="scan">${scanLabel}</div>
    <div class="offer">${offerBadge}</div>
    <div class="foot">${esc(m.claimUrl)}</div>
    ${m.brandName ? `<div class="brand">Built by ${esc(m.brandName)}</div>` : ''}
  </div>
</div></body></html>`;
}

/**
 * The postcard BACK (6×9 portrait, matching the front) — the message side. The lower
 * portion is left clear for Lob's address block + IMb/postage. Single source of truth
 * for the Lob send path AND the admin preview so what an operator previews is mailed.
 */
export function renderPosterBackHtml(m: PosterModel): string {
  const greeting = m.recipientName ? `Hi ${esc(m.recipientName)},` : 'Hello,';
  const deadlineLine = m.deadline
    ? `<div class="due">Claim by <b>${esc(m.deadline)}</b> — the domain goes to one ${m.restaurantComp ? 'restaurant' : 'business'} only.</div>`
    : '';
  const backHeadline = m.restaurantComp
    ? 'Your online-ordering website is already built.'
    : `Your website for ${esc(m.domain)} is already built.`;
  const backPara = m.restaurantComp
    ? `We built your restaurant a free website that takes online orders. Claim it first and <b>${esc(m.domain)}</b> points at you too — extra diners searching in ${esc(m.city)}.`
    : `We built a free, ready-to-launch website for your business. Scan the QR on the front (or visit the link below) to preview it and claim it before a competitor does.`;
  // Concrete benefit bullets — what the site DOES, so the pitch isn't only scarcity.
  const benefits = (m.benefits ?? []).slice(0, 3);
  const benefitsHtml = benefits.length
    ? `<ul class="benefits">${benefits.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>`
    : '';
  // Human sign-off: headshot + signature + name beat a logo for cold trust. Falls back to the
  // org "team" line for reseller/branded sends (where sender is intentionally null).
  const s = m.sender;
  const signOff = s
    ? `<div class="sender">
        ${s.headshotUrl ? `<img class="face" src="${esc(s.headshotUrl)}" alt="" />` : ''}
        <div class="smeta">
          ${s.signatureUrl ? `<img class="sign" src="${esc(s.signatureUrl)}" alt="" />` : ''}
          <div class="sname">— ${esc(s.name)}${s.title ? `, ${esc(s.title)}` : ''}</div>
          ${m.localLine ? `<div class="sloc">${esc(m.localLine)}</div>` : ''}
          ${s.email ? `<div class="sqa">Questions? ${esc(s.email)}</div>` : ''}
        </div>
      </div>`
    : m.brandName
      ? `<div class="sig">— The ${esc(m.brandName)} team${m.localLine ? ` · ${esc(m.localLine)}` : ''}</div>`
      : m.localLine
        ? `<div class="sig">From a local business · ${esc(m.localLine)}</div>`
        : '';
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  html,body { background:#fff; }
  .back {
    width:6in; height:9in; margin:0 auto; padding:.5in .55in;
    font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color:#0b1020;
    display:flex; flex-direction:column;
  }
  .hi { font-size:12pt; font-weight:700; color:#0f766e; }
  .h { margin-top:.06in; font-size:17pt; font-weight:800; line-height:1.15; }
  .p { margin-top:.14in; font-size:11.5pt; color:#334155; max-width:4.6in; line-height:1.4; }
  .benefits { margin:.14in 0 0 .02in; padding:0; list-style:none; max-width:4.6in; }
  .benefits li { position:relative; padding-left:.26in; margin:.07in 0; font-size:11pt; color:#0f172a; font-weight:600; line-height:1.3; }
  .benefits li::before { content:"✓"; position:absolute; left:0; color:#0f766e; font-weight:800; }
  .due { margin-top:.14in; font-size:11pt; color:#b45309; font-weight:600; max-width:4.6in; }
  .u { margin-top:.16in; font-size:10pt; color:#0f766e; word-break:break-all; }
  .sig { margin-top:.16in; font-size:10.5pt; color:#334155; font-weight:600; }
  .sender { margin-top:.16in; display:flex; align-items:center; gap:.14in; }
  .face { width:.7in; height:.7in; border-radius:999px; object-fit:cover; border:2px solid #0f766e; }
  .smeta { display:flex; flex-direction:column; }
  .sign { height:.42in; width:auto; max-width:2.4in; object-fit:contain; margin-bottom:.02in; }
  .sname { font-size:10.5pt; color:#334155; font-weight:700; }
  .sloc { font-size:9.5pt; color:#0f766e; font-weight:600; }
  .sqa { margin-top:.02in; font-size:9.5pt; color:#334155; }
  /* Keep the bottom ~3.5in clear for the USPS address block Lob overlays. */
  .spacer { flex:1; min-height:3.5in; }
  @media print { @page { size:6in 9in; margin:0; } body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
</style></head>
<body><div class="back">
  <div class="hi">${greeting}</div>
  <div class="h">${backHeadline}</div>
  <div class="p">${backPara}</div>
  ${benefitsHtml}
  ${deadlineLine}
  <div class="u">${esc(m.claimUrl)}</div>
  ${signOff}
  <div class="spacer"></div>
</div></body></html>`;
}
