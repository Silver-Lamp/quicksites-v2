// lib/listings/qrPack.ts
//
// Yard-sign QR pack — the physical half of the real-estate loop (crosstalk
// ideas.md §4, built on the HJ listen page contract: crosstalk/contracts/
// about-that-embed.md "Hosted listen page"). Given a listing_card block with an
// About That embed id, generate a self-contained printable HTML doc (the same
// pattern as the competition poster: inline styles, QR as data URL, no external
// assets) with three print assets:
//   1. Yard-sign insert (8.5×11 landscape) — scan at the curb, hear the agent
//      talk about THIS house.
//   2. Flyer corner card (4×6) — staple to the take-one flyer.
//   3. Business cards (3.5×2, 10-up on letter) — open-house handouts.
//
// The QR encodes the hosted listen page:
//   https://www.hivejournal.com/about-that/listen/<embedId>?url=<listingUrl>
// The page always loads; RENDERS 403 unless the listing URL's host is on the
// embed's allowed_domains — which is why callers must only offer the pack when
// a valid embed id is set (the route + editor both gate on it).

import QRCode from 'qrcode';

const LISTEN_BASE = 'https://www.hivejournal.com/about-that/listen';

export const EMBED_UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type QrPackModel = {
  embedId: string;
  /** The listing page's public URL — its HOST must be on the embed's allowed_domains. */
  listingUrl: string;
  headline: string;
  address: string;
  price: string;
  /** Agent/site attribution line (business name; custom domain if present). */
  attribution: string;
};

export function listenUrlFor(embedId: string, listingUrl: string): string {
  return `${LISTEN_BASE}/${encodeURIComponent(embedId)}?url=${encodeURIComponent(listingUrl)}`;
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export async function renderListingQrPackHtml(m: QrPackModel): Promise<string> {
  const listenUrl = listenUrlFor(m.embedId, m.listingUrl);
  const qr = await QRCode.toDataURL(listenUrl, { width: 900, margin: 1 });
  const line = [m.price, m.address].filter(Boolean).join(' · ');

  const card = `
    <div class="bizcard">
      <img src="${qr}" alt="QR" class="bc-qr" />
      <div class="bc-text">
        <div class="bc-hear">🔊 Hear about this home</div>
        <div class="bc-line">${esc(line)}</div>
        <div class="bc-attr">${esc(m.attribution)}</div>
      </div>
    </div>`;

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>QR pack — ${esc(m.address || m.headline)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #111; background: #fff; }
  .sheet { page-break-after: always; display: flex; flex-direction: column; align-items: center; justify-content: center; }
  .hint { font-family: system-ui, sans-serif; font-size: 11px; color: #999; text-align: center; padding: 8px; }
  @media print {
    @page { size: letter; margin: 0.5in; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .hint { display: none; }
  }

  /* 1 — Yard-sign insert */
  .yard { min-height: 9.5in; text-align: center; gap: 0.35in; }
  .yard .hear { font-size: 44px; font-weight: 700; letter-spacing: -0.5px; }
  .yard .sub { font-family: system-ui, sans-serif; font-size: 20px; color: #444; }
  .yard img { width: 5in; height: 5in; }
  .yard .line { font-size: 26px; font-weight: 600; }
  .yard .attr { font-family: system-ui, sans-serif; font-size: 16px; color: #666; }

  /* 2 — Flyer corner card (4x6 crop marks via border) */
  .flyer { min-height: 9.5in; }
  .flyer-card { width: 6in; height: 4in; border: 1px dashed #bbb; display: flex; align-items: center; gap: 0.3in; padding: 0.3in; }
  .flyer-card img { width: 2.6in; height: 2.6in; }
  .flyer-card .hear { font-size: 26px; font-weight: 700; }
  .flyer-card .sub { font-family: system-ui, sans-serif; font-size: 14px; color: #444; margin-top: 6px; }
  .flyer-card .line { font-size: 17px; font-weight: 600; margin-top: 10px; }
  .flyer-card .attr { font-family: system-ui, sans-serif; font-size: 12px; color: #666; margin-top: 6px; }

  /* 3 — Business cards, 10-up */
  .cards { display: grid; grid-template-columns: repeat(2, 3.5in); grid-auto-rows: 2in; justify-content: center; }
  .bizcard { width: 3.5in; height: 2in; border: 1px dashed #bbb; display: flex; align-items: center; gap: 0.15in; padding: 0.18in; }
  .bc-qr { width: 1.5in; height: 1.5in; }
  .bc-hear { font-size: 13px; font-weight: 700; }
  .bc-line { font-size: 11px; margin-top: 4px; }
  .bc-attr { font-family: system-ui, sans-serif; font-size: 9px; color: #666; margin-top: 4px; }
</style></head>
<body>
  <div class="hint">Print this page (⌘P / Ctrl+P). Dashed lines are cut guides. QR → ${esc(listenUrl)}</div>

  <section class="sheet yard">
    <div class="hear">🔊 Hear about this home</div>
    <div class="sub">Scan for a guided audio tour — the listing, in the agent's own words.</div>
    <img src="${qr}" alt="QR code" />
    ${line ? `<div class="line">${esc(line)}</div>` : ''}
    <div class="attr">${esc(m.attribution)}</div>
  </section>

  <section class="sheet flyer">
    <div class="flyer-card">
      <img src="${qr}" alt="QR code" />
      <div>
        <div class="hear">🔊 Hear about this home</div>
        <div class="sub">Scan for the audio tour.</div>
        ${line ? `<div class="line">${esc(line)}</div>` : ''}
        <div class="attr">${esc(m.attribution)}</div>
      </div>
    </div>
  </section>

  <section class="sheet">
    <div class="cards">${Array.from({ length: 10 }, () => card).join('')}</div>
  </section>
</body></html>`;
}
