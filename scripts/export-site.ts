// scripts/export-site.ts
//
// Save a published site as one self-contained HTML file its owner keeps.
//
//   npx tsx --env-file=.env.local scripts/export-site.ts https://<slug>.quicksites.ai/ [out.html]
//
// ⚠️ IT EXPORTS WHAT A VISITOR SEES. Loads the real published URL, strips our own controls,
// embeds every image as a data: URI, and writes a file that opens with no network. If it cannot
// fetch an image it SAYS SO and exits non-zero rather than shipping a file with holes in it — an
// export that silently loses the hero is worse than no export, because the owner only finds out
// when they need it.
import fs from 'node:fs';
import { chromium } from 'playwright';
import { COLLECT_ASSETS, STRIP_OURS, injectStyle, inlineImages, inlineCssAssets, exportBanner } from '../lib/sites/exportSite';

async function main() {
  const url = process.argv[2];
  if (!url) throw new Error('usage: export-site.ts <published-url> [out.html]');
  const out = process.argv[3] ?? '/tmp/site-export.html';

  const failedCss: string[] = [];
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  const assets: { css: string[]; imgs: string[] } = await page.evaluate(COLLECT_ASSETS);
  const imageUrls = assets.imgs;

  // Stylesheets first: CSS carries background images, so it must be fetched before the image
  // sweep in order for those URLs to be found and embedded.
  let cssText = '';
  for (const href of assets.css) {
    try {
      const res = await page.request.get(href);
      if (res.ok()) cssText += `\n/* ${href} */\n` + (await res.text());
      else failedCss.push(`${href} (HTTP ${res.status()})`);
    } catch (e) {
      failedCss.push(`${href} (${e instanceof Error ? e.message : 'fetch failed'})`);
    }
  }
  // ⚠️ RELATIVE url() TOO — fonts are the ones that bite. `/fonts/Inter.ttf` is not an https URL,
  // so an absolute-only sweep left it behind and the saved file went looking for it on a disk
  // where it does not exist. Resolve every url() against the page origin.
  for (const m of cssText.matchAll(/url\((?:"|')?([^"')]+)(?:"|')?\)/g)) {
    const raw = m[1].trim();
    if (raw.startsWith('data:')) continue;
    try { imageUrls.push(new URL(raw, url).toString()); } catch { /* unresolvable, skip */ }
  }

  // Fetch through the browser's context so storage URLs behave exactly as they did on the page.
  const map: Record<string, string> = {};
  const failed: string[] = [];
  const missingAtSource: string[] = [];
  for (const u of imageUrls) {
    if (u.startsWith('data:')) continue;
    try {
      const res = await page.request.get(u);
      // ⚠️ 404 AT SOURCE IS NOT AN EXPORT FAILURE. If the asset is already missing from the live
      // site, a file that also lacks it is a FAITHFUL copy — blocking would refuse to export any
      // site that has a broken reference, which is most of them eventually. Anything else (5xx,
      // network, timeout) means WE failed to gather something that exists, and that does block.
      if (res.status() === 404) { missingAtSource.push(u); continue; }
      if (!res.ok()) { failed.push(`${u} (HTTP ${res.status()})`); continue; }
      const buf = await res.body();
      const type = res.headers()['content-type']?.split(';')[0] || 'image/png';
      map[u] = `data:${type};base64,${buf.toString('base64')}`;
    } catch (e) {
      failed.push(`${u} (${e instanceof Error ? e.message : 'fetch failed'})`);
    }
  }

  // Embed the images INTO the CSS too, then inject it and strip our furniture.
  // The CSS refers to assets in their ORIGINAL form (often relative); the map is keyed by the
  // absolute URL we fetched. Replace both spellings or the inline silently misses.
  const cssMap: Record<string, string> = { ...map };
  for (const [abs, data] of Object.entries(map)) {
    try {
      const rel = new URL(abs).pathname;
      if (cssText.includes(rel)) cssMap[rel] = data;
    } catch { /* ignore */ }
  }
  cssText = inlineCssAssets(cssText, cssMap);
  await page.evaluate(STRIP_OURS);

  const raw: string = await page.content();
  await browser.close();

  const html =
    exportBanner(url, new Date().toISOString().slice(0, 10)) +
    injectStyle(inlineImages(raw, map), cssText);
  fs.writeFileSync(out, html);

  // ⚠️ "It produced a file" is not "it worked". An earlier version wrote 480 MB and reported
  // success on every other metric.
  const mb = html.length / 1024 / 1024;
  if (mb > 25) {
    console.error(`\n  ⚠️ export is ${mb.toFixed(0)} MB — too large to be useful. Not shipping.`);
    process.exit(1);
  }

  const remoteLeft = (html.match(/https?:\/\/[^"')\s]+\.(png|jpe?g|webp|gif|svg)/gi) || []).length;
  console.log(`\n  ${out}`);
  console.log(`  ${Math.round(html.length / 1024)} KB · ${Object.keys(map).length} image(s) · ${assets.css.length} stylesheet(s) embedded`);
  console.log(`  remote image refs left: ${remoteLeft}`);
  if (missingAtSource.length) {
    console.log(`\n  note: ${missingAtSource.length} asset(s) are 404 on the live site itself, so the copy lacks them too:`);
    for (const m of missingAtSource) console.log(`     ${m}`);
    console.log('  (that is a bug on the site, not in this export)');
  }
  if (failedCss.length) {
    console.error(`\n  ⚠️ ${failedCss.length} stylesheet(s) could NOT be embedded — the file will not look like the site:`);
    for (const f of failedCss) console.error(`     ${f}`);
    process.exit(1);
  }
  if (failed.length) {
    console.error(`\n  ⚠️ ${failed.length} image(s) could NOT be embedded:`);
    for (const f of failed) console.error(`     ${f}`);
    process.exit(1);
  }
  console.log('');
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
