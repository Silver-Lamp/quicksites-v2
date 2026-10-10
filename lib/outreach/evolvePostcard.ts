// lib/outreach/evolvePostcard.ts
//
// The postcard for the "site, but no online ordering" segment: a restaurant that already has a
// website gets a card saying its menu is now orderable from a phone and its site stays as it is,
// with a QR to the Evolve page (their site beside the ordering draft, preview ordering, the
// claim button). Pure — model + HTML; the send loop is in ./evolvePostcardSend.ts.
//
// ⚠️ SAME RULES AS THE CLAIM CARD (lib/outreach/claimPostcard.ts): a card cannot be caveated or
// walked back, and it goes to a stranger under a real business's name. No ranking / search /
// "Google" claim, no guarantee, no deadline, no competitor, no printed price (the fee is derived
// on the page, never printed), no results promise, a stated exit, a human to reach.
// lib/outreach/__tests__/evolvePostcard.test.ts greps the rendered HTML for every one.
//
// ⚠️ ONLY FOR A DRAFT THAT CARRIES A MENU. The card says "built from your own menu"; a draft with
// no menu block is the generic scaffold and must never be mailed as one (the Evolve page refuses
// to exhibit it for the same reason). The selector in evolvePostcardSend.ts blocks it.
import { qrDataUrlFor, resolveLocalityLine, senderFromProfile, type PostcardSender } from '@/lib/outreach/competitionPoster';
import type { SenderProfile } from '@/lib/outreach/senderProfile';
import type { Prospect } from '@/lib/outreach/prospects';
import { printableHost } from '@/lib/outreach/claimPostcard';

/** True of every from-site ordering draft on the day it is mailed, and of nothing else. */
export const EVOLVE_CARD_BENEFITS: readonly string[] = [
  'Built from your own menu — you confirm the prices before anything goes live',
  'Order ahead for pickup, from a phone',
  'Your current website stays exactly as it is',
];

export type EvolvePostcardModel = {
  businessName: string;
  city: string | null;
  region: string | null;
  /** Their current site, for print ("pizzarockisland.com"). */
  currentHost: string;
  /** The tracked link: counts the scan, then lands on the Evolve page. */
  evolveLinkUrl: string;
  qrDataUrl: string;
  benefits: string[];
  sender: PostcardSender | null;
  brandName: string | null;
  localLine: string | null;
  contactEmail: string | null;
};

/**
 * The tracked link printed on the card — /go/<id>?to=evolve counts the visit and lands on
 * /evolve/<id>. A rep's card carries their code so the scan is credited to them.
 */
export function trackedEvolveUrl(prospectId: string, base: string, refCode?: string | null): string {
  const ref = refCode && /^[a-z0-9-]{2,40}$/i.test(refCode) ? `&ref=${encodeURIComponent(refCode)}` : '';
  return `${base.replace(/\/+$/, '')}/go/${prospectId}?to=evolve${ref}`;
}

export async function buildEvolvePostcardModel(input: {
  prospect: Pick<Prospect, 'id' | 'business_name' | 'city' | 'region' | 'website' | 'address_lat' | 'address_lon'>;
  senderProfile: SenderProfile;
  brandName?: string | null;
  supportEmail?: string | null;
  baseUrl: string;
  /** The rep's code, when the card is theirs to hand over. */
  refCode?: string | null;
}): Promise<EvolvePostcardModel> {
  const evolveLinkUrl = trackedEvolveUrl(input.prospect.id, input.baseUrl, input.refCode);
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
    currentHost: printableHost(input.prospect.website ?? '').replace(/^www\./, ''),
    evolveLinkUrl,
    qrDataUrl: await qrDataUrlFor(evolveLinkUrl),
    benefits: [...EVOLVE_CARD_BENEFITS],
    sender,
    brandName: input.brandName ?? null,
    localLine,
    contactEmail: sender?.email ?? input.supportEmail ?? null,
  };
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
}

/** 6×9 front (landscape, Lob 9.25in × 6.25in with bleed). Copy left, QR column positioned right. */
export function renderEvolvePostcardFront(m: EvolvePostcardModel): string {
  const benefitsHtml = `<ul class="benefits">${m.benefits.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>`;
  const long = m.businessName.trim().length > 26;
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  html,body { background:#fff; }
  /* Same geometry as the claim card: landscape, text column left, QR column POSITIONED right,
     fine print POSITIONED at the bottom — Lob honours absolute positioning and ignores flex spacers. */
  .card { position:relative; width:9.25in; height:6.25in; margin:0 auto; padding:.5in 3.4in .5in .6in; background:#0b1020; color:#fff;
    font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
  .kicker { font-size:11pt; font-weight:700; letter-spacing:.04em; text-transform:uppercase; color:#5eead4; }
  .h { margin-top:.14in; font-size:31pt; font-weight:800; line-height:1.06; }
  .h b { color:#5eead4; }
  .sub { margin-top:.2in; font-size:13pt; color:#cbd5e1; line-height:1.45; max-width:4.9in; }
  .sub b { color:#fff; overflow-wrap:anywhere; }
  .benefits { margin:.28in 0 0 .02in; padding:0; list-style:none; max-width:4.9in; }
  .benefits li { position:relative; padding-left:.3in; margin:.1in 0; font-size:12.5pt; color:#e2e8f0; font-weight:600; line-height:1.3; }
  .benefits li::before { content:"✓"; position:absolute; left:0; color:#5eead4; font-weight:800; }
  .card.long .h { font-size:25pt; }
  .card.long .sub { margin-top:.14in; font-size:12pt; }
  .card.long .benefits li { margin:.07in 0; font-size:11.5pt; }
  .qrwrap { position:absolute; right:.55in; top:.5in; bottom:.5in; width:2.5in; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:.16in; text-align:center; }
  .qr { width:2.2in; height:2.2in; background:#fff; padding:.1in; border-radius:.12in; }
  .qr img { width:100%; height:100%; display:block; }
  .scan { font-size:11pt; color:#cbd5e1; line-height:1.4; max-width:2.6in; }
  .scan b { color:#fff; }
  .fine { position:absolute; left:.6in; right:3.4in; bottom:.5in; font-size:8.5pt; color:#94a3b8; line-height:1.35; }
  @media print { @page { size:9.25in 6.25in; margin:0; } body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
</style></head>
<body><div class="card${long ? ' long' : ''}">
  <div class="kicker">${esc(m.businessName)}</div>
  <div class="h">Your menu, <b>orderable from a phone</b>. Your site stays as it is.</div>
  <div class="sub">We read the menu on <b>${esc(m.currentHost)}</b> and built an ordering page from it — order ahead for pickup, your prices, and a text to you the moment one is paid.</div>
  ${benefitsHtml}
  <div class="qrwrap">
    <div class="scan"><b>Scan to see it beside your site.</b><br/>Try an order on it — nothing is charged.</div>
    <div class="qr"><img src="${m.qrDataUrl}" alt="QR code" /></div>
  </div>
  <div class="fine">Not for you? Say the word and it’s gone — ${m.contactEmail ? esc(m.contactEmail) : 'reply to this card'}.</div>
</div></body></html>`;
}

/** 6×9 back: what it is, what it costs in words, the link, the exit, a human. Right side clear for USPS. */
export function renderEvolvePostcardBack(m: EvolvePostcardModel): string {
  const s = m.sender;
  const signOff = s
    ? `<div class="sender">
        ${s.headshotUrl ? `<img class="face" src="${esc(s.headshotUrl)}" alt="" />` : ''}
        <div class="smeta">
          ${s.signatureUrl ? `<img class="sign" src="${esc(s.signatureUrl)}" alt="" />` : ''}
          <div class="sname">— ${esc(s.name)}${s.title ? `, ${esc(s.title)}` : ''}</div>
          ${m.localLine ? `<div class="sloc">${esc(m.localLine)}</div>` : ''}
          ${s.email ? `<div class="sqa">Questions? ${esc(s.email)}</div>` : ''}
          ${s.bookingUrl ? `<div class="sqa">Prefer to talk? Book 15 minutes: ${esc(printableHost(s.bookingUrl))}</div>` : ''}
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
  .back { position:relative; width:9.25in; height:6.25in; margin:0 auto; padding:.45in .5in .4in .55in; color:#0b1020; display:flex; flex-direction:column;
    font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
  .hi { font-size:12pt; font-weight:700; color:#0f766e; }
  .p { margin-top:.12in; font-size:11.5pt; color:#334155; max-width:4.6in; line-height:1.4; }
  .p b { color:#0b1020; }
  .u { margin-top:.12in; font-size:10.5pt; color:#0f766e; word-break:break-all; }
  .exit { margin-top:.14in; font-size:10.5pt; color:#334155; max-width:4.6in; line-height:1.4; }
  .sig { position:absolute; left:.55in; bottom:.45in; font-size:10.5pt; color:#334155; font-weight:600; }
  .sender { position:absolute; left:.55in; bottom:.42in; width:4.6in; display:flex; align-items:center; gap:.14in; }
  .face { width:.7in; height:.7in; border-radius:999px; object-fit:cover; border:2px solid #0f766e; }
  .smeta { display:flex; flex-direction:column; }
  .sign { height:.42in; width:auto; max-width:2.4in; object-fit:contain; margin-bottom:.02in; }
  .sname { font-size:10.5pt; color:#334155; font-weight:700; }
  .sloc { font-size:9.5pt; color:#0f766e; font-weight:600; }
  .sqa { margin-top:.02in; font-size:9.5pt; color:#334155; }
  .spacer { flex:1; }
  @media print { @page { size:9.25in 6.25in; margin:0; } body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
</style></head>
<body><div class="back">
  <div class="hi">Hi ${esc(m.businessName)},</div>
  <div class="p">Your website at <b>${esc(m.currentHost)}</b> is up and it stays as it is. What it cannot do is take an order from a phone to pick up. We built that page from the menu already on your site; you confirm the prices before anything goes live.</div>
  <div class="p">No monthly fee and no contract — a share of each online order, only when one comes in. The exact share is on the page. Scan the front or open the link below to see it beside your site and try an order; nothing is charged.</div>
  <div class="u">${esc(m.evolveLinkUrl)}</div>
  <div class="exit">Not for you? Say the word and it’s gone the same day${m.contactEmail ? ` — email ${esc(m.contactEmail)}` : ''}.</div>
  ${signOff}
  <div class="spacer"></div>
</div></body></html>`;
}
