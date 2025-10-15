// lib/qr/text-fit.ts
// Helpers to compute a safe font size (and optional ellipsis) that fits within a target width.

export type FitOptions = {
    min: number;          // minimum font size (pt)
    max: number;          // maximum font size (pt)
    step?: number;        // decrement step when shrinking (pt), default 0.5
    ellipsize?: boolean;  // add "…" if still too long at min size
  };
  
  // Quick width estimator for client (pdf-lib path):
  // Approx: each char ≈ 0.55 * fontSize. Good enough for sans-serif captions.
  export function estimateWidthPx(text: string, fontSize: number) {
    return text.length * (fontSize * 0.55);
  }
  
  export function fitTextOneLine(text: string, maxWidthPx: number, opts: FitOptions) {
    const step = opts.step ?? 0.5;
    let size = Math.min(opts.max, Math.max(opts.min, opts.max));
    while (size >= opts.min) {
      const w = estimateWidthPx(text, size);
      if (w <= maxWidthPx) {
        return { fontSize: size, text };
      }
      size -= step;
    }
    if (opts.ellipsize) {
      // binary search shortest ellipsis string that fits at min
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
  