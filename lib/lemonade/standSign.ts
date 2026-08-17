// lib/lemonade/standSign.ts
//
// The printable half of a lemonade stand. A stand's whole problem is a customer standing in
// front of it with no cash, so the site is useless until there is a physical thing on the table
// telling them they can pay with their phone. This renders that: a self-contained HTML doc with
// the QR baked in as a data URL — same pattern as lib/listings/qrPack.ts, no external assets, so
// it prints correctly from a phone, a Chromebook, or a library computer with no network.
//
// Two sheets, because a stand needs two different things:
//   1. A table sign (letter, portrait) — big enough to read from the sidewalk.
//   2. Six cup cards (2×3.5, 6-up) — hand one over with the drink so someone can pay after
//      they've walked off, which is when a lot of "I'll come back with money" actually converts.
//
// ⚠️ DELIBERATELY NO CHILD'S NAME, PHOTO OR ADDRESS ANYWHERE, and no parameter to add one.
// A yard sign is already a public statement that a particular child is at a particular house at
// a particular time; adding a full name to it is a different thing entirely, and the difference
// is not one a nine-year-old is in a position to weigh. The stand name is the site's own title,
// which the grown-up chose and can change.
import QRCode from 'qrcode';
import { lemonYumSiteUrl } from '@/lib/lemonade/lemonYum';

export type StandSignModel = {
  /** The stand's public site URL — what the QR resolves to. */
  standUrl: string;
  /** Display name of the stand, e.g. "The Corner Lemonade Stand". */
  standName: string;
  /** Optional one-liner, e.g. "Saving up for a new bike". Rendered only if present. */
  cause?: string | null;
  /**
   * The stand's menu, for the printed board. Prices are strings exactly as the owner typed
   * them ("$3", "$2.50") — never reformatted, because a printed price is a promise to a
   * stranger and the owner's own wording is the one they will honour at the table.
   */
  menu?: Array<{ name: string; items: Array<{ name: string; price?: string | null }> }> | null;
};

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * The URL a stand's QR should resolve to. Pure, and separate from the renderer so it can be
 * asserted without generating a PNG.
 *
 * ⚠️ NOT `lib/seo/indexNow.ts#publicIndexUrl`, which looks like the same function and is not:
 * it returns null for an ordinary site with no custom domain, because its job is deciding what
 * to submit to a search engine. Encoding null into a QR would print a sign nobody can scan.
 */
export function standUrlFor(t: { slug?: string | null; custom_domain?: string | null; domain?: string | null }): string | null {
  const custom = (t.custom_domain || t.domain || '').trim();
  if (custom) return `https://${custom.replace(/^https?:\/\//, '').replace(/\/+$/, '')}`;
  const slug = (t.slug || '').trim();
  if (!slug) return null;
  // Prefer the branded host once lemonyum.com is configured: shorter to print, easier to read
  // aloud, and reliably linkified in phone messaging apps (a `.com`, unlike delivered.menu's
  // gTLD — see docs/LEMONYUM_PLAN.md §1). Falls back to the platform subdomain while inert, so
  // signs printed today keep working after the domain is pointed.
  return lemonYumSiteUrl(slug) ?? `https://${slug}.quicksites.ai`;
}

/**
 * Printable sign + cup cards for one stand. Returns a complete HTML document; the caller
 * serves it with `text/html` and the browser's own print dialog does the rest (no PDF
 * dependency, which is the reason this is HTML rather than a generated PDF).
 */
export async function renderStandSignHtml(m: StandSignModel): Promise<string> {
  // High error-correction: this sign lives outdoors on a folding table and will get splashed,
  // creased and shaded. 'H' tolerates ~30% of the code being unreadable, which is the
  // difference between a smudged sign that still works and a stand that takes no money.
  // ⚠️ SVG, NOT PNG, AND THE REASON IS BOTH SPEED AND PRINT QUALITY.
  //
  // A QR is pure geometry — flat black squares on white — which is the ideal case for a vector
  // and the worst case for a raster. Rendering these as PNGs big enough to print sharply
  // (2000px for a 7in kerbside code) measured **~20 SECONDS PER SHEET** in test, all of it
  // rasterising squares. A parent opening this on a phone would have watched a blank page.
  //
  // As SVG the same code is a few KB, renders in milliseconds, and is crisp at ANY size —
  // 2in on a cup card or 7in taped to a cooler, from one string. Raster QRs also soften at the
  // edges when a browser scales them, and a blurred module boundary is precisely what makes a
  // code fail to scan at distance.
  //
  // Still error-correction 'H': this lives outdoors on a folding table and will get splashed,
  // creased and shaded. 'H' tolerates ~30% of the code being unreadable, which is the
  // difference between a smudged sign that still works and a stand that takes no money.
  const qrSvg = await QRCode.toString(m.standUrl, { type: 'svg', margin: 1, errorCorrectionLevel: 'H' });
  const qrDataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(qrSvg)}`;
  const qrBig = qrDataUrl;
  const qrSmall = qrDataUrl;

  // Shown under the QR so a customer whose camera won't scan can still type it in. A sign that
  // only works for people with a working camera fails exactly the customer it exists for.
  const typeable = m.standUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');

  // ⚠️ A SEPARATE, ENORMOUS QR IS NOT REDUNDANT WITH THE TABLE SIGN. The sign is designed to be
  // read at conversational distance across a table. This one is for taping to a cooler, a fence
  // or a yard sign at the kerb, where the reader is in a car or on the far side of a lawn — a
  // 4.6in code that works at 3ft does not work at 20ft.
  // One vector serves every size — see the note above.
  const qrHuge = qrDataUrl;

  // The menu board. Only rendered when there is a real menu — an empty board printed with
  // headings and no dishes is worse than no board, and a stand with nothing priced yet is a
  // stand whose owner has not finished setting up.
  const pricedSections = (m.menu ?? [])
    .map((sec) => ({ ...sec, items: (sec.items ?? []).filter((i) => (i?.name || '').trim()) }))
    .filter((sec) => sec.items.length > 0);

  const menuSheet = pricedSections.length
    ? `<div class="sheet">
        <div class="board">
          <div class="board-name">${esc(m.standName)}</div>
          ${m.cause ? `<div class="board-cause">${esc(m.cause)}</div>` : ''}
          ${pricedSections
            .map(
              (sec) => `
            <div class="board-section">
              ${sec.name ? `<div class="board-heading">${esc(sec.name)}</div>` : ''}
              ${sec.items
                .map(
                  (it) => `<div class="board-row">
                      <span class="board-item">${esc(it.name)}</span>
                      <span class="board-dots"></span>
                      <span class="board-price">${esc((it.price || '').trim())}</span>
                    </div>`,
                )
                .join('')}
            </div>`,
            )
            .join('')}
          <div class="board-foot">
            <img src="${qrSmall}" alt="" class="board-qr" />
            <div>
              <div class="board-foot-title">No cash? Pay with your phone.</div>
              <div class="board-foot-url">${esc(typeable)}</div>
            </div>
          </div>
        </div>
      </div>`
    : '';

  const cupCard = `
    <div class="card">
      <img src="${qrSmall}" alt="" class="card-qr" />
      <div class="card-text">
        <div class="card-title">Pay with your phone</div>
        <div class="card-name">${esc(m.standName)}</div>
        <div class="card-url">${esc(typeable)}</div>
      </div>
    </div>`;

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Stand signs — ${esc(m.standName)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #1a1a1a; background: #fff; }
  .sheet { page-break-after: always; padding: 0.5in; }
  .sheet:last-child { page-break-after: auto; }

  /* ── Table sign ── */
  .sign { display: flex; flex-direction: column; align-items: center; text-align: center; height: 10in; justify-content: center; }
  .sign-eyebrow { font-size: 34px; font-weight: 800; letter-spacing: -0.5px; }
  .sign-name { margin-top: 10px; font-size: 26px; color: #444; }
  .sign-cause { margin-top: 6px; font-size: 19px; color: #666; font-style: italic; }
  .sign-qr { width: 4.6in; height: 4.6in; margin: 26px 0 14px; }
  .sign-url { font-size: 21px; color: #333; font-weight: 600; }
  .sign-how { margin-top: 26px; font-size: 19px; color: #555; line-height: 1.7; }
  .sign-how b { color: #1a1a1a; }

  /* ── Cup cards, 6-up ── */
  .cards { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: repeat(3, 3.1in); gap: 0.2in; }
  .card { border: 1px dashed #bbb; border-radius: 6px; padding: 0.2in; display: flex; align-items: center; gap: 0.18in; }
  .card-qr { width: 1.5in; height: 1.5in; flex: none; }
  .card-title { font-size: 15px; font-weight: 700; }
  .card-name { font-size: 13px; color: #555; margin-top: 3px; }
  .card-url { font-size: 11px; color: #777; margin-top: 6px; word-break: break-all; }

  /* ── Menu board: read from the pavement, so type is large and prices are unmissable ── */
  .board { height: 10in; display: flex; flex-direction: column; }
  .board-name { font-size: 44px; font-weight: 800; letter-spacing: -1px; text-align: center; }
  .board-cause { margin-top: 6px; font-size: 20px; color: #666; font-style: italic; text-align: center; }
  .board-section { margin-top: 30px; }
  .board-heading { font-size: 22px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #7a5c00; border-bottom: 3px solid #f2d16b; padding-bottom: 6px; }
  .board-row { display: flex; align-items: baseline; gap: 10px; margin-top: 16px; }
  .board-item { font-size: 30px; font-weight: 600; }
  /* A leader line, so the eye tracks from a long dish name to its price without slipping a row. */
  .board-dots { flex: 1; border-bottom: 2px dotted #ccc; transform: translateY(-6px); }
  .board-price { font-size: 30px; font-weight: 800; font-variant-numeric: tabular-nums; }
  .board-foot { margin-top: auto; display: flex; align-items: center; gap: 18px; border-top: 2px solid #eee; padding-top: 18px; }
  .board-qr { width: 1.5in; height: 1.5in; flex: none; }
  .board-foot-title { font-size: 22px; font-weight: 700; }
  .board-foot-url { font-size: 16px; color: #555; margin-top: 4px; }

  /* ── The kerbside code: as big as letter paper allows ── */
  .huge { height: 10in; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
  .huge-qr { width: 7.2in; height: 7.2in; }
  .huge-title { font-size: 40px; font-weight: 800; margin-bottom: 18px; }
  .huge-url { margin-top: 16px; font-size: 26px; font-weight: 600; }

  .hint { font-family: system-ui, sans-serif; font-size: 11px; color: #999; text-align: center; padding: 10px; }
  @media print {
    @page { size: letter; margin: 0; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .hint { display: none; }
  }
</style></head>
<body>
  <p class="hint">Print what you need — the menu board and table sign are the two that matter. Cut the cup cards along the dashed lines and hand one over with the drink.</p>

  ${menuSheet}

  <div class="sheet">
    <div class="sign">
      <div class="sign-eyebrow">No cash? Pay with your phone.</div>
      <div class="sign-name">${esc(m.standName)}</div>
      ${m.cause ? `<div class="sign-cause">${esc(m.cause)}</div>` : ''}
      <img src="${qrBig}" alt="Scan to pay" class="sign-qr" />
      <div class="sign-url">${esc(typeable)}</div>
      <div class="sign-how">
        <b>1.</b> Point your camera at the code &nbsp;·&nbsp; <b>2.</b> Pick what you want<br />
        <b>3.</b> Pay with Apple&nbsp;Pay, Google&nbsp;Pay or a card
      </div>
    </div>
  </div>

  <div class="sheet">
    <div class="cards">${cupCard.repeat(6)}</div>
  </div>

  <div class="sheet">
    <div class="huge">
      <div class="huge-title">Scan to order</div>
      <img src="${qrHuge}" alt="Scan to pay" class="huge-qr" />
      <div class="huge-url">${esc(typeable)}</div>
    </div>
  </div>
</body></html>`;
}
