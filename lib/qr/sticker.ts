// lib/qr/sticker.ts
// Raster sticker-sheet builder using pdf-lib.
// - Embed a PNG QR into label cells
// - Optional label-safe caption with auto-fit + ellipsis
// - Optional cut guides (rect/circle)
// Usage: see components/qr/StickerSheet.tsx

import { PDFDocument, rgb } from "pdf-lib";

/** Minimal shape expected from your preset (see lib/qr/sticker-presets.ts). */
export type StickerPreset = {
  id?: string;
  page: { width: number; height: number }; // points
  columns: number;
  rows: number;
  labelWidth: number;   // points
  labelHeight: number;  // points
  marginLeft: number;   // points
  marginTop: number;    // points
  hPitch: number;       // center-to-center horizontal (points)
  vPitch: number;       // center-to-center vertical (points)
  round?: boolean;      // if true, cut guide draws a circle
};

/** Fast width estimate for one-line sans-serif captions (good enough for client side). */
function estimateWidthPx(text: string, fontSize: number) {
  return text.length * (fontSize * 0.55);
}

/** Fit one-line text into a max width; shrink and optionally ellipsize if needed. */
function fitTextOneLine(
  text: string,
  maxWidthPx: number,
  opts: {
    min: number;          // min font size (pt)
    max: number;          // max font size (pt)
    step?: number;        // shrink step (pt), default 0.5
    ellipsize?: boolean;  // add … if still too long at min
  }
) {
  const step = opts.step ?? 0.5;
  let size = Math.min(opts.max, Math.max(opts.min, opts.max));
  while (size >= opts.min) {
    const w = estimateWidthPx(text, size);
    if (w <= maxWidthPx) return { fontSize: size, text };
    size -= step;
  }
  if (opts.ellipsize) {
    let lo = 0, hi = text.length;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      const candidate = text.slice(0, mid) + "…";
      const w = estimateWidthPx(candidate, opts.min);
      if (w <= maxWidthPx) lo = mid + 1; else hi = mid;
    }
    const final = text.slice(0, Math.max(0, lo - 1)) + "…";
    return { fontSize: opts.min, text: final };
  }
  return { fontSize: opts.min, text };
}

/** Normalize ArrayBuffer|Uint8Array to Uint8Array for pdf-lib. */
function toUint8(bytes: ArrayBuffer | Uint8Array): Uint8Array {
  return bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
}

export async function buildStickerSheetPdf(
  pngData: ArrayBuffer | Uint8Array,   // QR PNG bytes (flexible)
  preset: StickerPreset,
  opts?: {
    /** Padding inside each label boundary (0..0.45), default 0.12 */
    qrPaddingPct?: number;
    /** Optional caption text (e.g., electinfo.org/c/xyz) */
    caption?: string;
    /** Caption color (default black) */
    captionColor?: { r: number; g: number; b: number };
    /** Auto-fit the caption into the label width (default true) */
    autoFitCaption?: boolean;
    /** Caption min/max font sizes (pt), defaults 6..9 */
    captionMin?: number;
    captionMax?: number;
    /** Safe margin on left/right as % of label width (0..0.3), default 0.06 */
    captionSafeMarginPct?: number;
    /** Ellipsize caption when too long, default true */
    ellipsize?: boolean;

    /** Draw cut guides around each label (default false) */
    showCutGuides?: boolean;
    /** Cut guide color gray (0..1), default 0.6 */
    guideGray?: number;
    /** Cut guide stroke width (pt), default 0.6 */
    guideStroke?: number;
  }
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([preset.page.width, preset.page.height]);

  // Normalize for pdf-lib
  const png = toUint8(pngData);
  const qrImage = await pdf.embedPng(png);

  // Options with sensible defaults
  const paddingPct = Math.min(Math.max(opts?.qrPaddingPct ?? 0.12, 0), 0.45);
  const captionColor = opts?.captionColor ?? { r: 0, g: 0, b: 0 };
  const showGuides = !!opts?.showCutGuides;
  const guideGray = Math.min(Math.max(opts?.guideGray ?? 0.6, 0), 1);
  const guideStroke = Math.max(opts?.guideStroke ?? 0.6, 0.1);

  const autoFit = opts?.autoFitCaption ?? true;
  const capMin = opts?.captionMin ?? 6;
  const capMax = opts?.captionMax ?? 9;
  const safePct = Math.min(Math.max(opts?.captionSafeMarginPct ?? 0.06, 0), 0.3);
  const ellipsize = opts?.ellipsize ?? true;

  for (let row = 0; row < preset.rows; row++) {
    for (let col = 0; col < preset.columns; col++) {
      // Label origin
      const x = preset.marginLeft + col * preset.hPitch;
      const y = preset.page.height - preset.marginTop - (row + 1) * preset.vPitch + (preset.vPitch - preset.labelHeight);

      // Compute inner content area
      const innerW = preset.labelWidth * (1 - paddingPct * 2);
      const innerH = preset.labelHeight * (1 - paddingPct * 2);

      // Reserve baseline for caption if present (approximate)
      let capH = 0;
      let capSize = capMax;
      if (opts?.caption) capH = capSize + 4;

      // QR size & position within label
      const qrSize = Math.min(innerW, innerH - capH);
      const qrX = x + (preset.labelWidth - qrSize) / 2;
      const qrY = y + (preset.labelHeight - qrSize - capH) / 2 + (capH ? capH / 2 : 0);

      page.drawImage(qrImage, { x: qrX, y: qrY, width: qrSize, height: qrSize });

      // Caption (optional, label-safe)
      if (opts?.caption) {
        const capSafeW = preset.labelWidth * (1 - safePct * 2);
        let capText = opts.caption;

        if (autoFit) {
          const fit = fitTextOneLine(capText, capSafeW, {
            min: capMin,
            max: capMax,
            ellipsize,
          });
          capSize = fit.fontSize;
          capText = fit.text;
        }

        // Estimate width (client side) just for centering; acceptable for sans-serif
        const capWEst = estimateWidthPx(capText, capSize);
        const tx = x + (preset.labelWidth - capWEst) / 2;
        const ty = y + 4; // padding from bottom

        page.drawText(capText, {
          x: tx,
          y: ty,
          size: capSize,
          color: rgb(captionColor.r, captionColor.g, captionColor.b),
        });
      }

      // Cut guides
      if (showGuides) {
        const c = rgb(guideGray, guideGray, guideGray);
        if (preset.round) {
          // Circle guide for round labels
          page.drawEllipse({
            x: x + preset.labelWidth / 2,
            y: y + preset.labelHeight / 2,
            xScale: preset.labelWidth / 2,
            yScale: preset.labelHeight / 2,
            borderColor: c,
            borderWidth: guideStroke,
          });
        } else {
          // Rect guide for rectangular labels
          page.drawRectangle({
            x,
            y,
            width: preset.labelWidth,
            height: preset.labelHeight,
            borderColor: c,
            borderWidth: guideStroke,
          });
        }
      }
    }
  }

  return await pdf.save();
}

/** Browser-only PDF download helper. No-op on the server. */
export function downloadPdf(filename: string, bytes: ArrayBuffer | Uint8Array): void {
  if (typeof window === "undefined") return; // SSR/Node guard

  // Normalize and build the blob as a BufferSource (ArrayBufferView is OK)
  const data = toUint8(bytes) as unknown as BlobPart;
  const blob = new Blob([data], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}
