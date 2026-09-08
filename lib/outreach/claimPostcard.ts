// lib/outreach/claimPostcard.ts
//
// The per-business claim postcard for an auto-built trade site: "we built you a website, here it
// is, claim it free, or say the word and it's gone." Pure — model + HTML; the send loop is in
// ./claimPostcardSend.ts.
//
// ⚠️ THIS IS THE MOST CONSERVATIVE SURFACE WE OWN. A postcard cannot be caveated in conversation
// or walked back, and it goes to a stranger under a real business's name. So:
//   - no ranking, traffic or "Google" claim (docs/GEO_RENTAL_RUNBOOK.md: never promise a result);
//   - no scarcity, no deadline, no competitor (the competition mechanic stays OUT — OUTREACH_FIVE);
//   - no price (a printed number cannot follow the env);
//   - the exit is stated ("say the word and it's gone"), same as docs/OUTREACH_METHOD.md;
//   - a human to reach: the sender's email, or the brand's support email.
// lib/outreach/__tests__/claimPostcard.test.ts greps the rendered HTML for every one of these.
//
// Why a postcard at all when OUTREACH_METHOD forbids a claim link in a cold message: that rule is
// about SMS to a phone that may be wrong or forwarded. A card mailed to the listing's street
// address is the channel Google itself uses to prove control of a Business Profile. It goes
// there and nowhere else.
import { qrDataUrlFor, postcardBenefits, resolveLocalityLine, senderFromProfile, type PostcardSender } from '@/lib/outreach/competitionPoster';
import type { SenderProfile } from '@/lib/outreach/senderProfile';
import type { Prospect } from '@/lib/outreach/prospects';
import type { IndustryKey } from '@/lib/industries';
import { makesOperationalClaim, claimKind } from '@/lib/rebuild/scrubInventedClaims';
import { isTradeIndustry, tradeSiteBaseUrl } from '@/lib/tradeSites/config';

export type ClaimPostcardModel = {
  businessName: string;
  city: string | null;
  region: string | null;
  industryKey: IndustryKey | null;
  /** The draft's public address, watermarked until claimed. */
  siteUrl: string;
  /** The tracked link (/go/<prospectId>) — mints a fresh claim token on visit. */
  claimUrl: string;
  qrDataUrl: string;
  benefits: string[];
  sender: PostcardSender | null;
  brandName: string | null;
  localLine: string | null;
  contactEmail: string | null;
};

/** The tracked claim link printed on the card. Never the raw tokenised URL — a fresh token is minted on visit. */
export function trackedDraftClaimUrl(prospectId: string, base: string = tradeSiteBaseUrl()): string {
  return `${base.replace(/\/+$/, '')}/go/${prospectId}`;
}

/** Strip the scheme for print: "smithtowing.quicksites.ai" reads; "https://…" does not. */
export function printableHost(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/+$/, '');
}

/**
 * Pure: is this prospect one the card can go to? Built, unmailed, no website, a trade, and an
 * address to mail to. The claim-content gate (draftHasOperationalClaims) is a separate check on
 * the template data, run at send time.
 */
export function isMailableProspect(
  p: Pick<Prospect, 'status' | 'template_id' | 'lead_tier' | 'industry_key' | 'address'> & { postcard_sent_at?: string | null },
): boolean {
  return (
    p.status === 'draft_built' &&
    !!p.template_id &&
    !p.postcard_sent_at &&
    p.lead_tier === 'no_website' &&
    isTradeIndustry(p.industry_key) &&
    !!(p.address && p.address.trim())
  );
}

const ANSWER_FIELDS = new Set(['answer', 'a']);

/**
 * The send gate: a draft carrying an operational claim ("24/7", "licensed and insured", a
 * response time) is never mailed under a real business's name. A filter downstream of the
 * generator is not a fix for the generator (#903 fixed that) — but at the point of postage it is
 * the last thing standing between an invented promise and a stranger's mailbox.
 *
 * Same bucket rule as scripts/audit-live-claims.mjs: a question is not a claim, and a pricing
 * phrase OUTSIDE an answer ("Get a Free Quote" on a button) is an invitation, kept by #906's
 * decision. In an answer it is a commitment and still blocks.
 */
export function draftHasOperationalClaims(data: unknown): boolean {
  let hit = false;
  (function walk(n: any) {
    if (hit) return;
    if (Array.isArray(n)) return n.forEach(walk);
    if (n && typeof n === 'object') {
      for (const [k, v] of Object.entries(n)) {
        if (typeof v === 'string') {
          if (k === 'question' || k === 'q' || v.trim().endsWith('?')) continue;
          if (!makesOperationalClaim(v)) continue;
          if (claimKind(v) === 'pricing' && !ANSWER_FIELDS.has(k)) continue;
          hit = true;
          return;
        } else walk(v);
      }
    }
  })(data);
  return hit;
}

export async function buildClaimPostcardModel(input: {
  prospect: Pick<Prospect, 'id' | 'business_name' | 'city' | 'region' | 'industry_key' | 'address_lat' | 'address_lon'>;
  siteUrl: string;
  senderProfile: SenderProfile;
  brandName?: string | null;
  supportEmail?: string | null;
  baseUrl?: string;
}): Promise<ClaimPostcardModel> {
  const claimUrl = trackedDraftClaimUrl(input.prospect.id, input.baseUrl);
  const industryKey = (input.prospect.industry_key as IndustryKey | null) ?? null;
  const sender = senderFromProfile(input.senderProfile, input.brandName ?? null);
  const localLine = resolveLocalityLine({
    senderCity: input.senderProfile.city,
    senderState: input.senderProfile.state,
    senderLat: input.senderProfile.lat,
    senderLng: input.senderProfile.lng,
    targetState: input.prospect.region,
    targetLat: input.prospect.address_lat,
    targetLng: input.prospect.address_lon,
  });
  return {
    businessName: input.prospect.business_name,
    city: input.prospect.city,
    region: input.prospect.region,
    industryKey,
    siteUrl: input.siteUrl,
    claimUrl,
    qrDataUrl: await qrDataUrlFor(claimUrl),
    benefits: industryKey ? postcardBenefits(industryKey).slice(0, 3) : [],
    sender,
    brandName: input.brandName ?? null,
    localLine,
    contactEmail: sender?.email ?? input.supportEmail ?? null,
  };
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
}

/** 6×9 front: the business's name, where the site is, and a QR. Nothing else. */
export function renderClaimPostcardFront(m: ClaimPostcardModel): string {
  const host = printableHost(m.siteUrl);
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  html,body { background:#fff; }
  .card { width:6in; height:9in; margin:0 auto; padding:.55in .6in; background:#0b1020; color:#fff;
    font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; display:flex; flex-direction:column; }
  .kicker { font-size:11pt; font-weight:700; letter-spacing:.04em; text-transform:uppercase; color:#5eead4; }
  .h { margin-top:.12in; font-size:26pt; font-weight:800; line-height:1.08; }
  .h b { color:#5eead4; }
  .sub { margin-top:.16in; font-size:12.5pt; color:#cbd5e1; line-height:1.4; max-width:4.7in; }
  .host { margin-top:.1in; font-size:14pt; font-weight:700; color:#fff; word-break:break-all; }
  .alt { margin-top:.06in; font-size:10.5pt; font-style:italic; color:#94a3b8; }
  .qrwrap { margin-top:auto; display:flex; align-items:flex-end; justify-content:space-between; gap:.3in; }
  .qr { width:2.1in; height:2.1in; background:#fff; padding:.1in; border-radius:.12in; }
  .qr img { width:100%; height:100%; display:block; }
  .scan { font-size:11pt; color:#cbd5e1; line-height:1.4; max-width:2.6in; }
  .scan b { color:#fff; }
  .fine { margin-top:.18in; font-size:8.5pt; color:#94a3b8; line-height:1.35; }
  @media print { @page { size:6in 9in; margin:0; } body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
</style></head>
<body><div class="card">
  <div class="kicker">${esc(m.businessName)}</div>
  <div class="h">We built <b>${esc(m.businessName)}</b> a website.</div>
  <div class="sub">It’s already online — built from your public listing: name, phone, address and hours.</div>
  <div class="host">${esc(host)}</div>
  <div class="alt">Prefer something simpler, like yourbusiness.com? That’s one step away once it’s yours.</div>
  <div class="qrwrap">
    <div class="scan"><b>Scan to see it and claim it.</b><br/>Free. Yours to edit. No card needed.</div>
    <div class="qr"><img src="${m.qrDataUrl}" alt="QR code" /></div>
  </div>
  <div class="fine">Don’t want it? Say the word and it’s gone — ${m.contactEmail ? esc(m.contactEmail) : 'reply to this card'}.</div>
</div></body></html>`;
}

/** 6×9 back: what it is, how to claim, the exit, and a human. Bottom 3.5in stays clear for USPS. */
export function renderClaimPostcardBack(m: ClaimPostcardModel): string {
  const host = printableHost(m.siteUrl);
  const trade = m.industryKey ? m.industryKey.replace(/_/g, ' ') : 'local service';
  const benefitsHtml = m.benefits.length ? `<ul class="benefits">${m.benefits.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : '';
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
      ? `<div class="sig">— The ${esc(m.brandName)} team${m.contactEmail ? ` · ${esc(m.contactEmail)}` : ''}</div>`
      : '';
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  html,body { background:#fff; }
  .back { width:6in; height:9in; margin:0 auto; padding:.5in .55in; color:#0b1020; display:flex; flex-direction:column;
    font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
  .hi { font-size:12pt; font-weight:700; color:#0f766e; }
  .p { margin-top:.12in; font-size:11.5pt; color:#334155; max-width:4.6in; line-height:1.4; }
  .p b { color:#0b1020; }
  .u { margin-top:.12in; font-size:10.5pt; color:#0f766e; word-break:break-all; }
  .benefits { margin:.14in 0 0 .02in; padding:0; list-style:none; max-width:4.6in; }
  .benefits li { position:relative; padding-left:.26in; margin:.06in 0; font-size:11pt; color:#0f172a; font-weight:600; line-height:1.3; }
  .benefits li::before { content:"✓"; position:absolute; left:0; color:#0f766e; font-weight:800; }
  .exit { margin-top:.14in; font-size:10.5pt; color:#334155; max-width:4.6in; line-height:1.4; }
  .sig { margin-top:.16in; font-size:10.5pt; color:#334155; font-weight:600; }
  .sender { margin-top:.14in; display:flex; align-items:center; gap:.14in; }
  .face { width:.7in; height:.7in; border-radius:999px; object-fit:cover; border:2px solid #0f766e; }
  .smeta { display:flex; flex-direction:column; }
  .sign { height:.42in; width:auto; max-width:2.4in; object-fit:contain; margin-bottom:.02in; }
  .sname { font-size:10.5pt; color:#334155; font-weight:700; }
  .sloc { font-size:9.5pt; color:#0f766e; font-weight:600; }
  .sqa { margin-top:.02in; font-size:9.5pt; color:#334155; }
  .spacer { flex:1; min-height:3.5in; }
  @media print { @page { size:6in 9in; margin:0; } body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
</style></head>
<body><div class="back">
  <div class="hi">Hi ${esc(m.businessName)},</div>
  <div class="p">We build websites for ${esc(trade)} businesses that don’t have one yet, starting from the public listing — the name, phone, address and hours anyone can already see. Yours is at <b>${esc(host)}</b>.</div>
  <div class="p">If you want it, scan the code on the front or open the link below. It’s free, it’s yours to edit, and your own .com is the one thing we charge for.</div>
  <div class="u">${esc(m.claimUrl)}</div>
  ${benefitsHtml}
  <div class="exit">Don’t want it? Say the word and it’s gone the same day${m.contactEmail ? ` — email ${esc(m.contactEmail)}` : ''}.</div>
  ${signOff}
  <div class="spacer"></div>
</div></body></html>`;
}
