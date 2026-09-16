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

/** Generic form: whatever the evaluated script returned. `worker` = an owner-run machine
 *  (lib/jobs/renderQueue.ts) evaluated the same string and handed the value back. */
export type EvaluateResult<T> =
  | { ok: true; value: T; driver: 'playwright' | 'serverless' | 'worker' }
  | { ok: false; error: string; driver: 'playwright' | 'serverless' | 'worker' | 'none' };

const VIEWPORT = { width: 1280, height: 900 };
/** Fonts and late layout shift settle here; a snapshot mid-swap describes a page nobody sees. */
const SETTLE_MS = 1200;

/**
 * When navigation counts as done. `networkidle` (the verifier's default) is the honest choice for
 * "what a stranger sees", but a store with analytics/captcha beacons NEVER goes idle: hicustom.com
 * timed out at 30s on the production function (2026-09-16) while Chromium itself was fine. Callers
 * whose page-side script does its own settling pass `domcontentloaded`.
 */
export type WaitUntil = 'networkidle' | 'load' | 'domcontentloaded';

/** Local + CI. Playwright is a dev dependency, so this cannot run in the deployed runtime. */
async function viaPlaywright<T>(url: string, js: string, timeoutMs: number, waitUntil: WaitUntil): Promise<EvaluateResult<T>> {
  let browser: any;
  try {
    const { chromium } = await import('playwright');
    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: VIEWPORT });
    await page.goto(url, { waitUntil, timeout: timeoutMs });
    await page.waitForTimeout(SETTLE_MS);
    const raw = await page.evaluate(js);
    return { ok: true, value: raw as T, driver: 'playwright' };
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
async function viaServerless<T>(url: string, js: string, timeoutMs: number, waitUntil: WaitUntil): Promise<EvaluateResult<T>> {
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
    // puppeteer spells network-idle differently from playwright; the other two are shared.
    await page.goto(url, { waitUntil: waitUntil === 'networkidle' ? 'networkidle0' : waitUntil, timeout: timeoutMs });
    await new Promise((r) => setTimeout(r, SETTLE_MS));
    const raw = await page.evaluate(js);
    return { ok: true, value: raw as T, driver: 'serverless' };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e), driver: 'serverless' };
  } finally {
    await browser?.close().catch(() => {});
  }
}

/**
 * Render a URL and evaluate `js` in it, with whichever driver this process can actually run.
 *
 * Playwright first when it is present (local + CI, and much faster to start); the serverless
 * driver otherwise. `prefer` forces one, which is how the probe tests the runtime path
 * specifically rather than getting a passing answer from a driver production will never use.
 *
 * The script is a string both drivers evaluate unchanged (see the header). It may return a
 * promise — both drivers await it — which is how a caller scrolls for lazy images before reading.
 */
export async function renderEvaluate<T>(
  url: string,
  js: string,
  opts: { prefer?: 'playwright' | 'serverless'; timeoutMs?: number; waitUntil?: WaitUntil } = {},
): Promise<EvaluateResult<T>> {
  const timeoutMs = opts.timeoutMs ?? 60_000;
  const waitUntil = opts.waitUntil ?? 'networkidle';
  if (opts.prefer === 'serverless') return viaServerless<T>(url, js, timeoutMs, waitUntil);
  if (opts.prefer === 'playwright') return viaPlaywright<T>(url, js, timeoutMs, waitUntil);

  const pw = await viaPlaywright<T>(url, js, timeoutMs, waitUntil);
  if (pw.ok) return pw;
  const sl = await viaServerless<T>(url, js, timeoutMs, waitUntil);
  if (sl.ok) return sl;
  // Both failed: report BOTH reasons. "could not render" without saying what was tried sends the
  // next person to debug the wrong half.
  return { ok: false, driver: 'none', error: `playwright: ${pw.error} | serverless: ${sl.error}` };
}

/** The verifier's render: the page as a stranger reads it (EXTRACT_JS). */
export async function renderPage(
  url: string,
  prefer?: 'playwright' | 'serverless',
): Promise<RenderResult> {
  const r = await renderEvaluate<RenderedPage>(url, EXTRACT_JS, { prefer });
  // renderEvaluate never returns 'worker' itself; narrow for the verifier's own result type.
  if (r.ok) return { ok: true, page: r.value, driver: r.driver === 'worker' ? 'serverless' : r.driver };
  return { ok: false, error: r.error, driver: r.driver === 'worker' ? 'none' : r.driver };
}
