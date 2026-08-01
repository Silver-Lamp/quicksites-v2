// lib/rebuild/pdfLines.ts
//
// The pure half of PDF reading: positioned glyph runs -> readable lines.
//
// ⚠️ SPLIT FROM pdfText.ts DELIBERATELY. The other half must set a worker URL via
// `import.meta.url`, which is browser/ESM-only and cannot be required by the test runner. That
// one line was enough to make the ordering logic — the part that can actually be WRONG in a way
// nobody notices — untestable. Keeping the logic here, free of any browser dependency, is what
// lets the two-column regression test exist.
//
// Nothing in this file touches the DOM, a worker, or pdfjs itself; it only understands the
// shape pdfjs returns.

/** The shape pdfjs hands back: a glyph run plus its 6-element transform matrix. */
export type TextItemLike = { str?: string; transform?: number[] };

/** Rows within this many points of each other are the same visual line. */
const ROW_TOLERANCE_PT = 2;

/**
 * Rebuild readable lines from positioned glyph runs.
 *
 * ⚠️ THIS IS THE WHOLE DIFFICULTY OF READING A PDF. A PDF has no lines and no paragraphs — it
 * has glyph runs at coordinates. pdfjs returns them in the order the *document* stores them,
 * which for a two-column résumé commonly alternates between columns. Concatenating `item.str`
 * in the order given (the obvious implementation, and the one most snippets show) produces
 * text that looks plausible and is factually scrambled: a job title from the left column
 * followed by a date from the right.
 *
 * That matters more here than it would elsewhere. The parser downstream is deliberately
 * deterministic because a CV is a factual claim about someone's employment — and scrambled
 * input defeats that guarantee just as thoroughly as a model that invents would.
 *
 * So: group by y (top-down, since PDF y grows upward), order by x within a row, join.
 */
export function linesFromItems(items: TextItemLike[]): string[] {
  const glyphs: { x: number; y: number; s: string }[] = [];
  for (const item of items) {
    const s = String(item?.str ?? '');
    if (!s.trim()) continue;
    glyphs.push({ x: item?.transform?.[4] ?? 0, y: item?.transform?.[5] ?? 0, s });
  }

  // ⚠️ CLUSTER, DON'T QUANTISE. The obvious way to add a tolerance is to round y to a grid
  // (`Math.round(y / 2) * 2`). That is not a tolerance — it is a set of fixed buckets, so two
  // glyphs 1pt apart merge or split depending on WHERE THE BOUNDARY HAPPENS TO FALL: 700 and
  // 701 land in different buckets while 701 and 702 land in the same one. Baselines jitter by a
  // point constantly (font switches, superscripts, a bolded job title), so the grid version
  // splits lines in production and does it unpredictably — the worst kind of bug to chase,
  // because the same layout behaves differently at a different position on the page.
  //
  // Sorting by y and growing a cluster while the next glyph is within tolerance of it gives a
  // real tolerance: what matters is the distance between glyphs, never their absolute position.
  glyphs.sort((a, b) => b.y - a.y); // PDF y grows upward, so descending = top of page first

  const rows: { x: number; s: string }[][] = [];
  let anchor = Number.POSITIVE_INFINITY;
  for (const g of glyphs) {
    if (anchor - g.y > ROW_TOLERANCE_PT) {
      rows.push([]);
      anchor = g.y; // re-anchor per row so a long page can't drift a cluster open
    }
    rows[rows.length - 1].push({ x: g.x, s: g.s });
  }

  return rows
    .map((row) =>
      row
        .sort((a, b) => a.x - b.x)
        .map((i) => i.s)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(Boolean);
}

/**
 * How much text we got, NOT a diagnosis of why.
 *
 * ⚠️ THIS LIVES HERE SO IT CAN BE TESTED, because the rule it encodes was already broken once
 * and twelve passing tests didn't notice. The original returned `looksImageOnly: len < 200` and
 * the caller discarded the text and announced "that PDF looks like a scan" — to a real 142-char
 * résumé it had just extracted perfectly. Wrong twice: it destroyed the user's data, and it
 * asserted a cause it had no way to know.
 *
 *   'empty' — zero characters. The ONLY case where "there is no text layer" is supportable.
 *   'thin'  — under a page's worth. Could be a sparse CV, a cover page, a partial read; we
 *             don't know which, so the caller warns and still keeps the text.
 *   'ok'    — a normal amount.
 *
 * Per-page, because "thin" is meaningless without knowing how much page there was.
 */
export type ExtractionQuality = 'empty' | 'thin' | 'ok';

export const THIN_CHARS_PER_PAGE = 200;

export function classifyExtraction(text: string, pages: number): ExtractionQuality {
  if (!text.trim()) return 'empty';
  return text.length < THIN_CHARS_PER_PAGE * Math.max(1, pages) ? 'thin' : 'ok';
}
