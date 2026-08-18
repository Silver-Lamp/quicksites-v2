// lib/probe/checks.ts
//
// Content probe — assert what came BACK, not that something came back.
//
// ⚠️ THE WHOLE POINT IS THAT A STATUS CODE IS NOT EVIDENCE. Two of the failures that motivated
// this served `200` while being broken: `/yard-sale/new` returned 200 with the body "We don't
// recognise that code", and an OG route returned 200 declaring `image/svg+xml` while serving PNG
// bytes. A probe that checks status would have gone green on both, permanently. So every check
// here asserts CONTENT — text that must be present, text that must be absent, elements that must
// exist, or bytes that must match their declared type.
//
// ⚠️ AND A CHECK IS A SAMPLE UNLESS IT NAMES WHAT IT FIXED. A page is not one thing; it is a page
// under conditions. Every failure of this kind here came from choosing the condition by
// convenience: a screenshot taken under a light OS preference (headless Chromium's default) missed
// a bug that only appears under a dark one; a marketing-page check was reported as a claim about
// tenant sites. So `themes` is explicit per check, and the runner reports which conditions it ran.
//
// This module is PURE — no network, no browser — so the assertions are unit-testable and the
// runner stays a thin shell. Anything needing a real browser (computed styles under a theme) is
// described here as data and executed by scripts/content-probe.ts.

export type Theme = 'light' | 'dark';

export type ImageKind = 'png' | 'jpeg' | 'webp' | 'gif' | 'svg' | 'unknown';

export type Check = {
  /** Short, greppable. Appears in the failure output and in the issue body. */
  name: string;
  url: string;
  /** Why this check exists — printed on failure so nobody has to guess what broke. */
  because: string;
  mustContain?: string[];
  /** ⚠️ The highest-value assertion here: the wrong-body-under-200 class. */
  mustNotContain?: string[];
  /** Minimum counts of server-rendered elements — catches an empty shell served to crawlers. */
  minElements?: Partial<Record<'h1' | 'h2' | 'p' | 'a', number>>;
  minTextChars?: number;
  /** For binary routes: the bytes must actually BE this, whatever the header claims. */
  expectImage?: ImageKind;
  /**
   * Browser conditions to load under. Omit for fetch-only checks.
   * `expectColorScheme` asserts the CSS `color-scheme` the surface resolves to — which is what
   * native controls (checkbox, date picker, scrollbar) actually obey. No screenshot involved.
   */
  themes?: Theme[];
  expectColorScheme?: Theme;
  /**
   * WHICH element to read `color-scheme` from. Required alongside `expectColorScheme`.
   *
   * ⚠️ THIS FIELD EXISTS BECAUSE THE PROBE'S FIRST RUN GOT THIS WRONG, in the exact way it hunts.
   * The obvious node is `document.documentElement` — and it reads "normal", because the app scopes
   * the palette on a nested `[data-theme]` wrapper, not on <html>. `color-scheme` INHERITS, so the
   * control renders correctly while the root says nothing.
   *
   * The failure mode is the dangerous direction: had <html> happened to resolve "light", the check
   * would have passed while proving nothing whatsoever about the checkbox. So point this at the
   * thing that actually renders — a native control where one exists, the theme scope otherwise.
   */
  colorSchemeSelector?: string;
};

/** Count server-rendered elements. Deliberately counts the SERVED html, not a hydrated DOM. */
export function countElement(html: string, tag: string): number {
  const re = new RegExp(`<${tag}[\\s>]`, 'gi');
  return (html.match(re) ?? []).length;
}

/** Visible text with script/style removed — the crude proxy for "is there a page here". */
export function visibleText(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Identify an image from its leading bytes.
 *
 * ⚠️ Never trust `content-type` here — the bug this exists for was a route that declared SVG and
 * served PNG. The header is the claim; these bytes are the fact.
 */
export function sniffImage(buf: Uint8Array): ImageKind {
  const b = buf;
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (b.length >= 12 && String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP') return 'webp';
  if (b.length >= 6 && String.fromCharCode(...b.slice(0, 3)) === 'GIF') return 'gif';
  const head = String.fromCharCode(...b.slice(0, 300)).trim().toLowerCase();
  if (head.startsWith('<?xml') || head.startsWith('<svg')) return 'svg';
  return 'unknown';
}

/** Assertions that can be judged from served HTML alone. Returns human-readable failures. */
export function evaluateHtml(check: Check, html: string): string[] {
  const fails: string[] = [];
  for (const needle of check.mustContain ?? []) {
    if (!html.includes(needle)) fails.push(`missing expected text: ${JSON.stringify(needle)}`);
  }
  for (const needle of check.mustNotContain ?? []) {
    if (html.includes(needle)) fails.push(`served forbidden text: ${JSON.stringify(needle)}`);
  }
  for (const [tag, min] of Object.entries(check.minElements ?? {})) {
    const n = countElement(html, tag);
    if (n < (min as number)) fails.push(`only ${n} <${tag}> in the served HTML, wanted >= ${min}`);
  }
  if (check.minTextChars != null) {
    const len = visibleText(html).length;
    if (len < check.minTextChars) fails.push(`only ${len} chars of visible text, wanted >= ${check.minTextChars}`);
  }
  return fails;
}

export function evaluateImage(check: Check, buf: Uint8Array, declaredType: string): string[] {
  if (!check.expectImage) return [];
  const actual = sniffImage(buf);
  const fails: string[] = [];
  if (actual !== check.expectImage) fails.push(`bytes are ${actual}, expected ${check.expectImage}`);
  if (!declaredType.includes(actual) && actual !== 'unknown') {
    fails.push(`declared "${declaredType}" but bytes are ${actual} — the mismatch class`);
  }
  return fails;
}
