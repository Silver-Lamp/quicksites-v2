// lib/outreach/guestApologyCard.ts
//
// The apology postcard for someone who built a site as a guest and could not sign up.
//
// Different from the claim card in one way that matters: THEY built it. The claim card says "we
// built you a site from your listing"; this one says "you built this, our sign-up step failed
// you, it's still yours." Same 9.25in × 6.25in landscape, same absolutely-positioned layout Lob's
// renderer honours, same sign-off, and it goes through the same forbidden-promise test — an
// apology that promises anything is a pitch.
import { qrDataUrlFor, senderFromProfile, type PostcardSender } from '@/lib/outreach/competitionPoster';
import type { SenderProfile } from '@/lib/outreach/senderProfile';
import { tradeSiteBaseUrl } from '@/lib/tradeSites/config';

export type GuestApologyModel = {
  businessName: string;
  /** Their site's public address (bare host when safe, per lib/sites/baseSlug.ts). */
  siteUrl: string;
  /** The tracked link (/go/guest/<templateId>) — mints a claim cookie on visit, any device. */
  claimUrl: string;
  qrDataUrl: string;
  sender: PostcardSender | null;
  contactEmail: string | null;
};

/** The printed link. Never a bearer token — a fresh claim is minted on visit. */
export function trackedGuestClaimUrl(templateId: string, base: string = tradeSiteBaseUrl()): string {
  return `${base.replace(/\/+$/, '')}/go/guest/${templateId}`;
}

export async function buildGuestApologyModel(input: { templateId: string; businessName: string; siteUrl: string; senderProfile: SenderProfile }): Promise<GuestApologyModel> {
  const claimUrl = trackedGuestClaimUrl(input.templateId);
  const sender = senderFromProfile(input.senderProfile, null);
  return {
    businessName: input.businessName,
    siteUrl: input.siteUrl,
    claimUrl,
    qrDataUrl: await qrDataUrlFor(claimUrl),
    sender,
    contactEmail: sender?.email ?? null,
  };
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
}
const printableHost = (u: string) => u.replace(/^https?:\/\//, '').replace(/\/+$/, '');

export function renderGuestApologyFront(m: GuestApologyModel): string {
  const host = printableHost(m.siteUrl);
  const long = m.businessName.length > 28;
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  html,body { background:#fff; }
  .card { position:relative; width:9.25in; height:6.25in; margin:0 auto; padding:.5in 3.4in .5in .6in; background:#0b1020; color:#fff;
    font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
  .kicker { font-size:11pt; font-weight:700; letter-spacing:.04em; text-transform:uppercase; color:#5eead4; }
  .h { margin-top:.12in; font-size:30pt; font-weight:800; line-height:1.06; }
  .card.long .h { font-size:25pt; }
  .h b { color:#5eead4; }
  .sub { margin-top:.18in; font-size:13.5pt; color:#e2e8f0; line-height:1.4; max-width:4.9in; }
  .sub b { color:#fff; }
  .host { margin-top:.16in; font-size:15pt; font-weight:700; color:#fff; word-break:break-all; }
  .alt { margin-top:.08in; font-size:11pt; color:#cbd5e1; line-height:1.4; max-width:4.9in; }
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
  <div class="h">You built <b>${esc(m.businessName)}</b> a website. We owe you an apology.</div>
  <div class="sub">Our sign-up step didn’t work when you tried it. <b>That was our fault, not yours.</b> Everything you made is still there, exactly as you left it.</div>
  <div class="host">${esc(host)}</div>
  <div class="alt">Scan the code to pick it back up and make it yours — free, no card needed.</div>
  <div class="qrwrap">
    <div class="scan"><b>Scan to reopen your site.</b><br/>Works from any phone or computer.</div>
    <div class="qr"><img src="${m.qrDataUrl}" alt="QR code" /></div>
  </div>
  <div class="fine">Don’t want it? Say the word and it’s gone — ${m.contactEmail ? esc(m.contactEmail) : 'reply to this card'}.</div>
</div></body></html>`;
}

export function renderGuestApologyBack(m: GuestApologyModel): string {
  const host = printableHost(m.siteUrl);
  const s = m.sender;
  const signOff = s
    ? `<div class="sender">
        ${s.headshotUrl ? `<img class="face" src="${esc(s.headshotUrl)}" alt="" />` : ''}
        <div class="smeta">
          ${s.signatureUrl ? `<img class="sign" src="${esc(s.signatureUrl)}" alt="" />` : ''}
          <div class="sname">— ${esc(s.name)}${s.title ? `, ${esc(s.title)}` : ''}</div>
          ${s.email ? `<div class="sqa">Questions? ${esc(s.email)}</div>` : ''}
          ${s.bookingUrl ? `<div class="sqa">Prefer to talk? Book 15 minutes: ${esc(printableHost(s.bookingUrl))}</div>` : ''}
        </div>
      </div>`
    : '';
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  html,body { background:#fff; }
  .back { position:relative; width:9.25in; height:6.25in; margin:0 auto; padding:.45in .5in .4in .55in; color:#0b1020;
    font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
  .hi { font-size:12pt; font-weight:700; color:#0f766e; }
  .p { margin-top:.12in; font-size:11.5pt; color:#334155; max-width:4.6in; line-height:1.4; }
  .p b { color:#0b1020; }
  .u { margin-top:.12in; font-size:10.5pt; color:#0f766e; word-break:break-all; }
  .sender { position:absolute; left:.55in; bottom:.42in; width:4.6in; display:flex; align-items:center; gap:.14in; }
  .face { width:.7in; height:.7in; border-radius:999px; object-fit:cover; border:2px solid #0f766e; }
  .smeta { display:flex; flex-direction:column; }
  .sign { height:.42in; width:auto; max-width:2.4in; object-fit:contain; margin-bottom:.02in; }
  .sname { font-size:10.5pt; color:#334155; font-weight:700; }
  .sqa { font-size:9.5pt; color:#334155; }
  @media print { @page { size:9.25in 6.25in; margin:0; } body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
</style></head>
<body><div class="back">
  <div class="hi">Hi ${esc(m.businessName)},</div>
  <div class="p">You built a website with us and then hit a sign-up step that didn’t work. We found the problem and fixed it — but by then you’d gone, and we had no way to tell you. <b>Sorry about that.</b></div>
  <div class="p">Your site is still at <b>${esc(host)}</b>, exactly as you left it. Scan the code on the front, or open the link below, and it becomes yours to publish. Free to keep; your own .com is the one thing we charge for.</div>
  <div class="u">${esc(m.claimUrl)}</div>
  <div class="p">Don’t want it? Say the word and it’s gone.</div>
  ${signOff}
</div></body></html>`;
}
