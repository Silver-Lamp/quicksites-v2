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

export function publicBaseUrl(): string {
  return (
    process.env.APP_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.QS_PUBLIC_URL ||
    'https://quicksites.ai'
  ).replace(/\/+$/, '');
}

/** The tokenized claim link for a pitch site — whoever signs up through it owns it. */
export function claimUrlFor(templateId: string): string {
  return `${publicBaseUrl()}/claim-site/${templateId}?token=${encodeURIComponent(mintSiteClaimToken(templateId))}`;
}

/** A tracked claim link (poster/SMS/postcard) — logs a visit, then redirects to claimUrlFor. */
export function trackedClaimUrl(campaignId: string): string {
  return `${publicBaseUrl()}/r/${campaignId}`;
}

export type PosterModel = {
  domain: string;
  industryLabel: string;
  city: string;
  region: string | null;
  businesses: string[];
  claimUrl: string;
  qrDataUrl: string;
};

export async function buildPosterModel(
  campaign: GeoCampaign,
  prospects: Prospect[],
): Promise<PosterModel | null> {
  if (!campaign.template_id) return null;
  // Tracked link so a poster/postcard scan registers as a claim-intent visit.
  const claimUrl = trackedClaimUrl(campaign.id);
  const qrDataUrl = await QRCode.toDataURL(claimUrl, { width: 480, margin: 1, errorCorrectionLevel: 'M' });
  return {
    domain: campaign.domain,
    industryLabel: KEY_TO_LABEL[campaign.industry_key as IndustryKey] ?? 'Local Services',
    city: campaign.city,
    region: campaign.region,
    businesses: prospects.map((p) => p.business_name),
    claimUrl,
    qrDataUrl,
  };
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
  const businessRows = m.businesses
    .slice(0, 6)
    .map((b) => `<div class="biz">${esc(b)}</div>`)
    .join('<div class="or">or</div>');

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
  .or { color:#f59e0b; font-weight:700; font-size:10.5pt; text-transform:uppercase; letter-spacing:.1em; margin:.02in 0; }
  .competition { margin-top:.2in; }
  .qrwrap { margin-top:auto; padding-top:.2in; }
  .qr { width:2.1in; height:2.1in; background:#fff; padding:.08in; border-radius:12px; }
  .scan { margin-top:.1in; font-size:12pt; font-weight:600; }
  .offer { margin-top:.14in; display:inline-block; background:#f59e0b; color:#111; font-weight:800; font-size:11pt; padding:.06in .18in; border-radius:999px; letter-spacing:.03em; }
  .foot { margin-top:.12in; color:#94a3b8; font-size:9pt; word-break:break-all; }
  @media print { @page { size: 6in 9in; margin: 0; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style></head>
<body><div class="poster">
  <div class="kicker">${esc(m.city)} · ${esc(m.industryLabel)}</div>
  <div class="headline">Own ${esc(place)}<br/>${esc(m.industryLabel)} online</div>
  <div class="domain">${esc(m.domain)}</div>
  <div class="sub">This premium local domain is available to <b>one</b> business.</div>
  <div class="competition">
    <div class="or" style="margin-bottom:.06in">First to claim it wins</div>
    ${businessRows}
  </div>
  <div class="qrwrap">
    <img class="qr" src="${m.qrDataUrl}" alt="Scan to claim ${esc(m.domain)}" />
    <div class="scan">Scan to preview &amp; claim your free site</div>
    <div class="offer">72-HOUR OFFERING</div>
    <div class="foot">${esc(m.claimUrl)}</div>
  </div>
</div></body></html>`;
}
