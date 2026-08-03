// lib/verify/render.ts
//
// Two ways to get a RenderedPage, one extractor.
//
// ⚠️ BOTH DRIVERS EVALUATE THE SAME STRING (`EXTRACT_JS`). If each had its own copy of the
// extraction logic they would drift, and the day they drift is the day the gate passes in CI and
// misses in production — which is the failure this whole module exists to prevent.
//
// ⚠️ THE IMPORTS ARE DYNAMIC AND THAT IS LOAD-BEARING. `playwright` is a dev dependency; a static
// import would drag it into the production bundle and break the build. `@sparticuz/chromium` is a
// ~50MB production dependency that must not load in a local dev process that will never use it.
//
// ⚠️ FAILURE TO LAUNCH IS REPORTED, NEVER SWALLOWED. A verifier that quietly returns "no findings"
// when its browser did not start is worse than having no verifier: it is a green row that means
// nothing, which is the exact shape of every silent failure in this repo's history.

import { EXTRACT_JS, type RenderedPage } from './extract';

export type RenderResult =
  | { ok: true; page: RenderedPage; driver: 'playwright' | 'serverless' }
  | { ok: false; error: string; driver: 'playwright' | 'serverless' | 'none' };

const VIEWPORT = { width: 1280, height: 900 };
/** Fonts and late layout shift settle here; a snapshot mid-swap describes a page nobody sees. */
const SETTLE_MS = 1200;

/** Local + CI. Playwright is a dev dependency, so this cannot run in the deployed runtime. */
async function viaPlaywright(url: string): Promise<RenderResult> {
  let browser: any;
  try {
    const { chromium } = await import('playwright');
    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: VIEWPORT });
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
    await page.waitForTimeout(SETTLE_MS);
    const raw = await page.evaluate(EXTRACT_JS);
    return { ok: true, page: raw as RenderedPage, driver: 'playwright' };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e), driver: 'playwright' };
  } finally {
    await browser?.close().catch(() => {});
  }
}

/**
 * The deployed runtime, via puppeteer-core + @sparticuz/chromium.
 *
 * ⚠️ UNPROVEN ON THIS PATH UNTIL A REAL INVOCATION SAYS OTHERWISE. Both packages are production
 * dependencies, but the only existing caller is an unrelated pricing-sync job, so "it is installed"
 * is not "it renders here". `GET /api/admin/verify/probe` exists to answer that from the running
 * process rather than from package.json — which is a claim about the repo, not about the runtime.
 */
async function viaServerless(url: string): Promise<RenderResult> {
  let browser: any;
  try {
    const chromium = (await import('@sparticuz/chromium')).default as any;
    const puppeteer = (await import('puppeteer-core')).default as any;
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: VIEWPORT,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 60_000 });
    await new Promise((r) => setTimeout(r, SETTLE_MS));
    const raw = await page.evaluate(EXTRACT_JS);
    return { ok: true, page: raw as RenderedPage, driver: 'serverless' };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e), driver: 'serverless' };
  } finally {
    await browser?.close().catch(() => {});
  }
}

/**
 * Render a URL with whichever driver this process can actually run.
 *
 * Playwright first when it is present (local + CI, and much faster to start); the serverless
 * driver otherwise. `prefer` forces one, which is how the probe tests the runtime path
 * specifically rather than getting a passing answer from a driver production will never use.
 */
export async function renderPage(
  url: string,
  prefer?: 'playwright' | 'serverless',
): Promise<RenderResult> {
  if (prefer === 'serverless') return viaServerless(url);
  if (prefer === 'playwright') return viaPlaywright(url);

  const pw = await viaPlaywright(url);
  if (pw.ok) return pw;
  const sl = await viaServerless(url);
  if (sl.ok) return sl;
  // Both failed: report BOTH reasons. "could not render" without saying what was tried sends the
  // next person to debug the wrong half.
  return { ok: false, driver: 'none', error: `playwright: ${pw.error} | serverless: ${sl.error}` };
}
