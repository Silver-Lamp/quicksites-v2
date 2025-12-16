// app/api/qr/sticker-vector/route.ts
// Next.js App Router — server route for VECTOR sticker sheet PDFs.
// Generates true vector QR (qrcode-svg) + optional center icon (SVG) + cut guides.
// Also supports label-safe caption with auto-fit + ellipsis.

import { NextResponse } from "next/server";
import PDFDocument from "pdfkit";
// @ts-ignore
import SVGtoPDF from "svg-to-pdfkit";
// @ts-ignore
import QRCodeSVG from "qrcode-svg";

/** Ensure Node.js runtime for pdfkit (not the Edge runtime). */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Preset = {
  page: { width: number; height: number };
  columns: number;
  rows: number;
  labelWidth: number;
  labelHeight: number;
  marginLeft: number;
  marginTop: number;
  hPitch: number;
  vPitch: number;
  round?: boolean;
};

const PRESETS: Record<string, Preset> = {
  // Avery 5160 — Address 1" x 2.625" (3 x 10)
  "avery-5160": {
    page: { width: 8.5 * 72, height: 11 * 72 },
    columns: 3,
    rows: 10,
    labelWidth: 2.625 * 72,
    labelHeight: 1 * 72,
    marginLeft: 0.1875 * 72,
    marginTop: 0.5 * 72,
    hPitch: 2.75 * 72,
    vPitch: 1 * 72,
  },

  // Avery 5163 — Shipping 2" x 4" (2 x 5)
  "avery-5163": {
    page: { width: 8.5 * 72, height: 11 * 72 },
    columns: 2,
    rows: 5,
    labelWidth: 4 * 72,
    labelHeight: 2 * 72,
    marginLeft: 0.15625 * 72,
    marginTop: 0.5 * 72,
    hPitch: 4.1875 * 72,
    vPitch: 2 * 72,
  },

  // Generic 2" squares (3 x 5)
  "square-2in-3x5": {
    page: { width: 8.5 * 72, height: 11 * 72 },
    columns: 3,
    rows: 5,
    labelWidth: 2 * 72,
    labelHeight: 2 * 72,
    marginLeft: 0.5 * 72,
    marginTop: 0.5 * 72,
    hPitch: 2.5 * 72,
    vPitch: 2.5 * 72,
  },

  // Avery 6450 — Round 2.5" (3 x 4)
  "avery-6450-round-2.5in": {
    page: { width: 8.5 * 72, height: 11 * 72 },
    columns: 3,
    rows: 4,
    labelWidth: 2.5 * 72,
    labelHeight: 2.5 * 72,
    marginLeft: 0.5 * 72,
    marginTop: 0.5 * 72,
    hPitch: 2.75 * 72,
    vPitch: 2.75 * 72,
    round: true,
  },
};

/** Auto-fit one-line caption with ellipsis using pdfkit's widthOfString. */
function fitCaption(
  doc: PDFKit.PDFDocument,
  text: string,
  maxWidth: number,
  min: number,
  max: number,
  step = 0.5,
  ellipsize = true
) {
  let size = Math.min(max, Math.max(min, max));
  while (size >= min) {
    const w = doc.widthOfString(text);
    if (w <= maxWidth) return { size, text };
    size -= step;
  }
  if (ellipsize) {
    let lo = 0,
      hi = text.length;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      const candidate = text.slice(0, mid) + "…";
      const w = doc.widthOfString(candidate);
      if (w <= maxWidth) lo = mid + 1;
      else hi = mid;
    }
    return { size: min, text: text.slice(0, Math.max(0, lo - 1)) + "…" };
  }
  return { size: min, text };
}

/** Built-in center icons (peace/V & check). Pass your own via centerIcon.svg for custom marks. */
function presetIcon(name: "peaceV" | "check"): string | undefined {
  if (name === "peaceV")
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="black" d="M354 52c12 0 22 10 22 22v122l16-7c11-5 24 1 29 12s-1 24-12 29l-33 14v68c0 63-51 114-114 114s-114-51-114-114v-82l-20 9c-11 5-24-1-29-12s1-24 12-29l69-31V74c0-12 10-22 22-22s22 10 22 22v98l20-9V74c0-12 10-22 22-22s22 10 22 22v83l48-22V74c0-12 10-22 22-22zM262 402c41 0 74-33 74-74v-51l-148 66v-15l148-66v-19l-148 66v-15l148-66V154l-48 22v20l-44 19v-38l-20 9v39l-44 19V94c0-6-4-10-10-10s-10 4-10 10v174l-40 18c-5 2-8 8-5 14s9 8 14 6l31-14v66c0 41 33 74 74 74z"/></svg>`;
  if (name === "check")
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="black" d="M199 372c-7 0-13-3-18-8L83 266c-10-10-10-26 0-36s26-10 36 0l80 80 194-194c10-10 26-10 36 0s10 26 0 36L217 364c-5 5-11 8-18 8z"/></svg>`;
  return undefined;
}

type Body = {
  value: string; // QR content (URL/text)
  presetId: keyof typeof PRESETS;
  /** Label padding inside the label bounds (0..0.45), default 0.12 */
  paddingPct?: number;
  /** Optional bottom caption (e.g., electinfo.org/c/xyz) */
  caption?: string;
  /** Center icon overlay config */
  centerIcon?: {
    preset?: "peaceV" | "check";
    svg?: string; // custom raw SVG
    sizePct?: number; // relative to QR size (0..1), default 0.35
  };
  /** Draw cut guides (circle/rect) around each label */
  showCutGuides?: boolean;

  /** Caption auto-fit params */
  autoFitCaption?: boolean; // default true
  captionMin?: number; // pt (default 6)
  captionMax?: number; // pt (default 9)
  captionSafeMarginPct?: number; // 0..0.3 (default 0.06)
  ellipsize?: boolean; // default true
};

export async function POST(req: Request) {
  try {
    const {
      value,
      presetId,
      paddingPct = 0.12,
      caption,
      centerIcon,
      showCutGuides,

      autoFitCaption = true,
      captionMin = 6,
      captionMax = 9,
      captionSafeMarginPct = 0.06,
      ellipsize = true,
    } = (await req.json()) as Body;

    const preset = PRESETS[presetId];
    if (!preset || !value) {
      return NextResponse.json({ ok: false, error: "BAD_INPUT" }, { status: 400 });
    }

    // Build vector QR (SVG path data)
    const qrSvg: string = new QRCodeSVG({
      content: value,
      join: true, // merge modules when possible
      container: "svg-viewbox",
      ecl: "M",
      padding: 0, // we handle label padding
    }).svg();

    // Optional center icon
    const overlaySvg: string | undefined =
      centerIcon?.svg ?? (centerIcon?.preset ? presetIcon(centerIcon.preset) : undefined);
    const overlaySizePct = Math.min(Math.max(centerIcon?.sizePct ?? 0.35, 0.05), 0.9);

    // PDF pipeline (vector)
    const doc = new PDFDocument({
      size: [preset.page.width, preset.page.height],
      margin: 0,
    });
    const stream = doc as unknown as NodeJS.ReadableStream;
    const chunks: Buffer[] = [];
    stream.on("data", (c: Buffer) => chunks.push(c));
    const finished = new Promise<Buffer>((resolve) =>
      stream.on("end", () => resolve(Buffer.concat(chunks as readonly Uint8Array[])))
    );

    const pad = Math.max(0, Math.min(paddingPct, 0.45));
    const safe = Math.min(Math.max(captionSafeMarginPct, 0), 0.3);

    for (let r = 0; r < preset.rows; r++) {
      for (let c = 0; c < preset.columns; c++) {
        // Label origin
        const x = preset.marginLeft + c * preset.hPitch;
        const yTop = preset.marginTop + r * preset.vPitch;
        const w = preset.labelWidth;
        const h = preset.labelHeight;

        // Inner content area
        const innerW = w * (1 - pad * 2);
        const captionReserve = caption ? 10 : 0; // bottom space for caption baseline
        const innerH = h * (1 - pad * 2) - captionReserve;
        const size = Math.min(innerW, innerH);

        const qrX = x + (w - size) / 2;
        const qrY = yTop + (h - size - captionReserve) / 2;

        // Place vector QR
        SVGtoPDF(doc, qrSvg, qrX, qrY, {
          assumePt: true,
          width: size,
          height: size,
        });

        // Center icon overlay (vector)
        if (overlaySvg) {
          const iconSize = size * overlaySizePct;
          const cx = qrX + (size - iconSize) / 2;
          const cy = qrY + (size - iconSize) / 2;
          SVGtoPDF(doc, overlaySvg, cx, cy, {
            assumePt: true,
            width: iconSize,
            height: iconSize,
          });
        }

        // Caption (bottom, label-safe fit)
        if (caption) {
          const safeW = w * (1 - safe * 2);
          let cap = caption;
          let capSize = captionMax;
          if (autoFitCaption) {
            const fit = fitCaption(doc, cap, safeW, captionMin, captionMax, 0.5, ellipsize);
            cap = fit.text;
            capSize = fit.size;
          }
          const textW = doc.widthOfString(cap);
          const tx = x + (w - textW) / 2;
          const ty = yTop + 4; // 4pt bottom padding
          doc.fontSize(capSize).fillColor("black").text(cap, tx, ty, { lineBreak: false });
        }

        // Cut guides (circle for round, rect otherwise)
        if (showCutGuides) {
          doc.save();
          doc.lineWidth(0.6).strokeColor("#999");
          if (preset.round) {
            const cx = x + w / 2;
            const cy = yTop + h / 2;
            const r = w / 2;
            doc.circle(cx, cy, r).stroke();
          } else {
            doc.rect(x, yTop, w, h).stroke();
          }
          doc.restore();
        }
      }
    }

    doc.end();
    const pdfBuf = await finished;

    return new NextResponse(pdfBuf.toString(), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="qr-stickers-${presetId}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("sticker-vector error:", e);
    return NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}
