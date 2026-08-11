// lib/sites/exportSite.ts
//
// A published site as ONE self-contained HTML file the owner keeps.
//
// ⚠️ THIS IS THE ONE THING WE OFFER THAT WAS PURE DEPENDENCY. The Verbatim résumé is a file the
// person walks away with. A signed agreement is a certificate both parties hold. A site was
// neither: if QuickSites went away, the owner had their words only in the sense that they could
// re-read them off a page that no longer loaded. "It's yours" was a claim about an account, not
// about an artifact — and we could not honestly tell a business "you can leave and take it with
// you", which is exactly the sentence that makes the offer trustworthy rather than a hook.
//
// ⚠️ IT EXPORTS THE RENDERED PAGE, NOT THE TEMPLATE JSON. Block JSON is ours — it needs our
// renderer, our registries and our React to mean anything, so handing it over is handing over a
// puzzle. The rendered page is theirs: it opens in any browser, forever, with no software from us.
// Same reasoning as the render gate — the received artifact is the real one.
//
// ⚠️ AND IT STRIPS OUR FURNITURE. The edit link, the settings gear and the "Hear this page"
// launcher are OUR controls on THEIR page; a file they keep or hand to another developer should
// not carry our chrome. Anything left behind would also be dead — it points at routes only this
// platform serves.

export type ExportedSite = {
  html: string;
  /** Bytes inlined, so a caller can report what it actually gathered. */
  inlinedImages: number;
  /** Images it could not fetch — reported, never silently dropped. */
  failedImages: string[];
};

/**
 * Runs inside the page. Kept as a string so the Playwright and serverless drivers cannot drift —
 * the same discipline as lib/verify/extract.ts.
 */
export const COLLECT_ASSETS = `(() => {
  const css = [...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => l.href);
  const imgs = new Set();
  document.querySelectorAll('img').forEach((i) => { if (i.src) imgs.add(i.src); });
  document.querySelectorAll('*').forEach((el) => {
    const bg = getComputedStyle(el).backgroundImage;
    const m = bg && bg.match(/url\\("?(https?:[^")]+)"?\\)/);
    if (m) imgs.add(m[1]);
  });
  return { css, imgs: [...imgs] };
})()`;

/**
 * ⚠️ INLINE THE STYLESHEETS OR THE FILE IS NOT A COPY OF ANYTHING. The first version of this
 * export stripped scripts, embedded the images, and left four <link rel=stylesheet> tags pointing
 * at /_next/static/css/*. Opened with the network blocked it rendered as unstyled HTML with the
 * hero missing entirely — the hero is a CSS background-image, so losing the stylesheet loses the
 * picture even though the picture was embedded. Correct text, no design, invisible image: a file
 * that looks like a broken copy of their site, which is worse than not offering one.
 */
export const STRIP_OURS = `(() => {
  // Our controls on their page. Matched by what they SAY, then removed with their fixed-position
  // wrapper — the launcher and the gear are portals with no stable hook of their own.
  // ⚠️ MATCH ON LETTERS ONLY. The launcher renders an icon inside the button, so its textContent
  // is "🔊 Hear this page" and an exact match missed it — the first pass reported the chrome
  // stripped while it was still on the page.
  const letters = (t) => (t || '').replace(/[^a-z]/gi, '').toLowerCase();
  const isOurs = (n) => {
    const l = letters(n.textContent);
    return l === 'hearthispage' || l === 'edit'
      || n.getAttribute('aria-label') === 'Site settings'
      || /QuickSites editor/i.test(n.getAttribute('title') || '');
  };
  document.querySelectorAll('button, a, [role="button"]').forEach((n) => {
    if (isOurs(n)) {
      let node = n;
      for (let i = 0; i < 4 && node.parentElement; i++) {
        const pos = getComputedStyle(node.parentElement).position;
        if (pos === 'fixed' || pos === 'sticky') { node = node.parentElement; break; }
        node = node.parentElement;
      }
      node.remove();
    }
  });

  // Runtime we cannot honour offline.
  document.querySelectorAll('script').forEach((n) => n.remove());
  document.querySelectorAll('link[rel="preload"], link[rel="prefetch"], link[rel="stylesheet"]').forEach((n) => n.remove());

  return true;
})()`;

/**
 * Insert the gathered CSS into the serialized HTML, in Node.
 *
 * ⚠️ NOT VIA page.evaluate. The first version passed the stylesheet text in as an argument and the
 * browser died — "Target page, context or browser has been closed" — because the CSS is ~3.7 MB
 * once its images are embedded, which overruns the CDP message limit. Nothing about the page needs
 * this CSS; only the FILE does. Splice it into the string afterwards and the size stops mattering.
 */
export function injectStyle(html: string, cssText: string): string {
  const tag = `<style data-qs-export>\n${cssText}\n</style>`;
  return html.includes('</head>') ? html.replace('</head>', `${tag}</head>`) : tag + html;
}

export function inlineImages(html: string, map: Record<string, string>): string {
  let out = html;
  for (const [url, dataUri] of Object.entries(map)) {
    // Both bare and HTML-escaped forms appear (src="…" vs style="background-image:url(&quot;…")).
    out = out.split(url).join(dataUri);
  }
  return out;
}

/**
 * A short banner at the top of the file, so whoever opens it in three years knows what it is.
 *
 * ⚠️ It is an HTML COMMENT, not visible content. This is their page; a visible "exported by"
 * line would be our branding on their document, which is the rule the résumé export and the
 * contractor flyer both follow.
 */
export function exportBanner(siteUrl: string, isoDate: string): string {
  return `<!--
  A copy of ${siteUrl}, saved ${isoDate}.
  This file is self-contained: images are embedded and it needs no internet connection.
  It is yours. Open it in any browser, host it anywhere, or hand it to another developer.
-->
`;
}

/**
 * Inline assets into CSS via custom properties, so each one is stored ONCE.
 *
 * ⚠️ NAIVE REPLACEMENT PRODUCED A 480 MB FILE. A stylesheet references the same asset from many
 * rules; substituting the data URI at each site stores a fresh multi-megabyte copy every time.
 * The export "succeeded" — it wrote a file, reported six images embedded and zero remote refs, and
 * every one of those numbers was true. It was simply half a gigabyte, which no owner can use and
 * no email will carry. A size assertion is now part of the generator, because "it produced output"
 * and "it worked" are different claims and only one of them had been checked.
 */
export function inlineCssAssets(css: string, map: Record<string, string>): string {
  const vars: string[] = [];
  let out = css;
  let i = 0;
  for (const [url, dataUri] of Object.entries(map)) {
    if (!out.includes(url)) continue;
    const name = `--qs-asset-${i++}`;
    vars.push(`${name}:url("${dataUri}")`);
    const escaped = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(`url\\(\\s*["']?${escaped}["']?\\s*\\)`, 'g'), `var(${name})`);
    // Anything left (odd quoting) still collapses to the single stored copy.
    out = out.split(url).join(`"" /*inlined*/`);
  }
  return vars.length ? `:root{${vars.join(';')}}\n${out}` : out;
}
