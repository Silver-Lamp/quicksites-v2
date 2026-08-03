// lib/verify/extract.ts
//
// What a stranger actually meets on a published page, in the order they meet it.
//
// ⚠️ THIS IS THE WHOLE POINT OF THE MODULE, SO IT IS WORTH BEING BLUNT: every check that has ever
// lied to us on a client site inspected an INPUT — the DB blocks, the editor, `tsc`, a grep of the
// source, a grep of the served HTML, DOM index order. Six of nine recorded failures had a
// perfectly correct upstream artefact and a wrong rendered page. The only two instruments that
// ever told the truth operated on the RECEIVED artefact: a screenshot, and rendered y-position.
//
// So the primitive here is not "inspect the page's source". It is "render the published URL and
// report what is visible, where it is, and what it looks like".
//
// ⚠️ IT IS A STRING ON PURPOSE. The extraction runs inside the browser, and we have two drivers —
// Playwright locally and in CI, puppeteer-core + @sparticuz/chromium in the serverless runtime. If
// each driver had its own copy of this logic they would drift, and the day they drift is the day
// the gate passes in CI and misses in production, which is the failure mode this exists to stop.
// One string, evaluated by both.
//
// ⚠️ READING ORDER, NOT DOM ORDER. Sorting by (y, x) rather than document position is the specific
// lesson from the disclosure-below-the-upload-control bug: DOM index and text order both returned
// the wrong answer, twice, on a page where the disclosure rendered ~600px below the control that
// collected a visitor's invoice. Position is the only thing that answers "does the visitor meet
// this before that".

export type TextNode = { text: string; y: number; x: number; tag: string };
export type Control = { kind: string; text: string; y: number };
export type ContrastIssue = { text: string; ratio: number; y: number };

export type RenderedPage = {
  url: string;
  title: string;
  /** Visible text joined in reading order — the document a stranger reads. */
  visibleText: string;
  nodes: TextNode[];
  /** Things that take input from a visitor: file inputs, buttons, form fields. */
  controls: Control[];
  contrast: ContrastIssue[];
  /** Non-empty proves the extractor actually ran against a rendered page. */
  scanned: { elements: number; visibleNodes: number };
};

/**
 * Browser-side extractor, as a string both drivers evaluate.
 *
 * Deliberately ES5-ish and dependency-free: it is evaluated raw inside a page with no transpiler
 * and no bundler, in two different Chromium builds.
 */
export const EXTRACT_JS = `(function () {
  function luminance(rgb) {
    var c = rgb.map(function (v) {
      v = v / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function parseRgba(s) {
    var m = /rgba?\\(([^)]+)\\)/.exec(s || '');
    if (!m) return null;
    var p = m[1].split(',').map(function (x) { return parseFloat(x); });
    var a = p.length > 3 ? p[3] : 1;
    if (a === 0) return null;   // fully transparent paints nothing
    return { r: p[0], g: p[1], b: p[2], a: a };
  }
  // ⚠️ ALPHA IS COMPOSITED, NOT IGNORED. The first version took the first non-transparent
  // background it found and treated it as opaque — so \`bg-amber-500/10\` (a 10% tint over a dark
  // page) was measured as SOLID AMBER, and reported 2:1 on text that is perfectly legible.
  // That is worse than missing the check: it cries wolf on the alpha-tint pattern CLAUDE.md §7
  // explicitly recommends, and a check that fires on correct code trains you to skip its output.
  function composite(fg, bg) {
    return [
      fg.r * fg.a + bg[0] * (1 - fg.a),
      fg.g * fg.a + bg[1] * (1 - fg.a),
      fg.b * fg.a + bg[2] * (1 - fg.a)
    ];
  }
  function effectiveBg(el) {
    var stack = [], n = el;
    while (n && n !== document.documentElement) {
      var c = parseRgba(getComputedStyle(n).backgroundColor);
      if (c) { stack.push(c); if (c.a === 1) break; }
      n = n.parentElement;
    }
    var base = parseRgba(getComputedStyle(document.documentElement).backgroundColor);
    var out = base ? [base.r, base.g, base.b] : [0, 0, 0];
    // Paint from the bottom of the stack up, so each tint lands on what is beneath it.
    for (var i = stack.length - 1; i >= 0; i--) out = composite(stack[i], out);
    return out;
  }
  function isFixedChrome(el) {
    // Our own floating platform UI (the "Hear this page" launcher, cookie bars) is not part of
    // the client's page. Counting it as "a control that collects from a visitor" made the gate
    // fail a correct page — the launcher sits at y=846 on every site, so it out-ranked every
    // disclosure everywhere.
    var n = el;
    while (n && n !== document.body) {
      var p = getComputedStyle(n).position;
      if (p === 'fixed' || p === 'sticky') return true;
      n = n.parentElement;
    }
    return false;
  }
  function contrast(fg, bg) {
    var a = luminance(fg) + 0.05, b = luminance(bg) + 0.05;
    return a > b ? a / b : b / a;
  }

  var all = [].slice.call(document.querySelectorAll('body *'));
  var nodes = [], contrastIssues = [], controls = [];

  for (var i = 0; i < all.length; i++) {
    var el = all[i];
    var style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) continue;
    var rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) continue;
    var y = Math.round(rect.top + window.scrollY);
    var x = Math.round(rect.left + window.scrollX);

    // Controls that take something FROM a visitor. These are the "after" side of every ordering
    // rule — the moment a disclosure has to have already happened.
    //
    // ⚠️ A BUTTON IS NOT AUTOMATICALLY A CONTROL THAT COLLECTS. The first version counted every
    // <button>, so our own "Hear this page" launcher — fixed chrome present on every page at the
    // same y — became the thing every disclosure had to precede, and the gate failed a page that
    // was correct. A control here means a field that takes input, or a button that submits one.
    var tag = el.tagName;
    if (!isFixedChrome(el)) {
      if ((tag === 'INPUT' && el.type !== 'hidden') || tag === 'TEXTAREA' || tag === 'SELECT') {
        controls.push({ kind: (el.type || tag).toLowerCase(), text: (el.name || el.placeholder || '').slice(0, 80), y: y });
      } else if (tag === 'LABEL' && el.querySelector('input[type=file]')) {
        controls.push({ kind: 'file', text: (el.textContent || '').trim().slice(0, 80), y: y });
      } else if (tag === 'BUTTON' && (el.type === 'submit' || el.closest('form'))) {
        controls.push({ kind: 'submit', text: (el.textContent || '').trim().slice(0, 80), y: y });
      }
    }

    // Leaf text only: an ancestor repeats every descendant's words, which would make the
    // "document a stranger reads" a document nobody could read.
    if (el.children.length !== 0) continue;
    var text = (el.textContent || '').replace(/\\s+/g, ' ').trim();
    if (!text) continue;

    nodes.push({ text: text, y: y, x: x, tag: tag });

    // Decorative glyphs (▹ • — ✓) are not prose, and a low-contrast divider is a design choice
    // rather than text nobody can read. Requiring two word-characters keeps the check pointed at
    // things a person is meant to READ.
    if (!/[\\w\\u00C0-\\u024F]{2}/.test(text)) continue;

    var fgc = parseRgba(style.color);
    if (fgc) {
      var bg = effectiveBg(el);
      // Text alpha composites too — muted-foreground is often an alpha of the foreground colour.
      var ratio = contrast(composite(fgc, bg), bg);
      // Computed, never a class grep. A shared wrapper hard-coding text-white was invisible to
      // every source-level check and to tsc; it is not invisible to a contrast calculation.
      if (ratio < 3) contrastIssues.push({ text: text.slice(0, 80), ratio: Math.round(ratio * 100) / 100, y: y });
    }
  }

  // ⚠️ (y, x), not DOM order. See the module header.
  nodes.sort(function (a, b) { return a.y - b.y || a.x - b.x; });
  controls.sort(function (a, b) { return a.y - b.y; });

  return {
    url: location.href,
    title: document.title || '',
    visibleText: nodes.map(function (n) { return n.text; }).join('\\n'),
    nodes: nodes,
    controls: controls,
    contrast: contrastIssues,
    scanned: { elements: all.length, visibleNodes: nodes.length }
  };
})()`;
