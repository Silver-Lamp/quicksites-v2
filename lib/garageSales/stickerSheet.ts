// lib/garageSales/stickerSheet.ts
//
// A printable sheet of garage-sale stickers to keep in the car.
//
// Self-contained HTML with every QR inlined as a data URL — same pattern as the yard-sign qrPack
// and the lemonade stand sign, for the same reason: it must print correctly from wherever the
// operator happens to be, with no network and no external assets to fail silently.
//
// ⚠️ THE STICKER TALKS TO THE SHOPPER, NOT THE SELLER. It ends up stuck on a cardboard sign at a
// junction, and everyone who reads it there is driving past looking for a sale. The seller only
// ever reads it once, in the hand of whoever gives it to them, with a person there to explain.
// So the printed words are "scan to see what's here", not "activate your free sale page" — copy
// aimed at the seller would be wasted on 99% of the people who see it, and would make the sign
// look like an advert for us rather than a sale.
//
// Layout is 12-up on US Letter at 2.5in — close enough to standard 2in square label stock to cut
// by hand, which is what v1 is: printed on paper, cut out, and stuck on with tape.
import QRCode from 'qrcode';
import { formatCode } from './codes';
import { yardSaleStickerUrl } from './yardSaleSites';

export type StickerSheetModel = {
  codes: string[];
  /** Base URL for the scan target, e.g. https://www.quicksites.ai */
  baseUrl: string;
  /** Printed small on the sheet margin so an operator can tell two batches apart. */
  batch?: string | null;
};

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function scanUrlFor(baseUrl: string, code: string): string {
  // Prefer the branded host once yardsalesites.com is configured — it is shorter on a sticker,
  // self-explaining to a stranger reading it at 20mph, and a `.com` so it linkifies when texted.
  // Falls back to the platform path while inert, so sheets printed today keep resolving.
  return yardSaleStickerUrl(code) ?? `${(baseUrl || '').replace(/\/+$/, '')}/s/${code}`;
}

export async function renderStickerSheetHtml(m: StickerSheetModel): Promise<string> {
  const stickers = await Promise.all(
    m.codes.map(async (code) => {
      const url = scanUrlFor(m.baseUrl, code);
      // 'H' error correction: this is going outdoors on cardboard, in the rain, at an angle.
      const qr = await QRCode.toDataURL(url, { width: 500, margin: 0, errorCorrectionLevel: 'H' });
      const typeable = url.replace(/^https?:\/\/(www\.)?/, '');
      return `
        <div class="sticker">
          <div class="s-top">GARAGE SALE</div>
          <img class="s-qr" src="${qr}" alt="" />
          <div class="s-scan">SCAN → see what’s here</div>
          <div class="s-pay">Pay by phone · no cash needed</div>
          <div class="s-url">${esc(typeable.replace(code, formatCode(code)))}</div>
        </div>`;
    }),
  );

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Garage sale stickers${m.batch ? ` — ${esc(m.batch)}` : ''}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #111; background: #fff; }
  .hint { font-size: 11px; color: #999; text-align: center; padding: 8px; }
  .sheet { display: grid; grid-template-columns: repeat(3, 2.5in); grid-auto-rows: 2.5in;
           gap: 0.12in; justify-content: center; padding: 0.35in 0; page-break-after: always; }
  .sheet:last-child { page-break-after: auto; }
  .sticker { border: 1px dashed #c9c9c9; border-radius: 10px; padding: 0.12in;
             display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
  .s-top { font-size: 13px; font-weight: 800; letter-spacing: 1.2px; }
  .s-qr { width: 1.35in; height: 1.35in; margin: 4px 0 5px; }
  .s-scan { font-size: 12px; font-weight: 700; }
  .s-pay { font-size: 9.5px; color: #555; margin-top: 2px; }
  .s-url { font-size: 8px; color: #888; margin-top: 4px; }
  .batch { font-size: 9px; color: #bbb; text-align: center; padding-bottom: 6px; }
  @media print {
    @page { size: letter; margin: 0; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .hint { display: none; }
  }
</style></head>
<body>
  <p class="hint">Print, cut along the dashed lines, keep them in the car. Each code works once.</p>
  <div class="sheet">${stickers.join('')}</div>
  ${m.batch ? `<div class="batch">batch ${esc(m.batch)}</div>` : ''}
</body></html>`;
}
