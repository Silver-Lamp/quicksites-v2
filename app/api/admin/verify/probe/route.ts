// app/api/admin/verify/probe/route.ts
//
// Does headless Chromium actually render in THIS runtime?
//
// ⚠️ THIS ROUTE EXISTS TO REPLACE AN ASSUMPTION WITH A MEASUREMENT. `@sparticuz/chromium` and
// `puppeteer-core` are production dependencies, which is a fact about package.json — not a fact
// about the deployed process. The only other caller is an unrelated pricing-sync job, so nothing
// has ever proved that this path launches a browser on a Vercel function: memory limits, the
// bundled binary, and the function's timeout are all plausible ways for it to fail, and all of
// them fail *here* rather than in CI.
//
// Designing a publish-time gate around an unproven runtime capability is how you build a check
// that is permanently, quietly broken in exactly the environment it was meant to protect.
//
// Admin-gated: it launches a browser and fetches an arbitrary URL, so it is a small SSRF and a
// real cost if left open. `?url=` defaults to our own homepage.

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireUser';
import { renderPage } from '@/lib/verify/render';
import { runRules, summarize } from '@/lib/verify/renderGate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Chromium cold-starts slowly. The default serverless timeout would report a capability failure
// that is really a timeout, which is the wrong lesson to learn from a probe.
export const maxDuration = 60;

export async function GET(req: Request) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url') || 'https://www.quicksites.ai/';
  // Force the runtime driver by default: letting it fall back to Playwright would return a
  // cheerful pass from a driver that does not exist in production, which is the exact question
  // being asked.
  const prefer = searchParams.get('driver') === 'auto' ? undefined : ('serverless' as const);

  const started = Date.now();
  const r = await renderPage(url, prefer);
  const ms = Date.now() - started;

  if (!r.ok) {
    return NextResponse.json(
      { ok: false, driver: r.driver, ms, url, error: r.error, verdict: 'serverless Chromium did NOT render here' },
      { status: 200 }, // a working probe reporting a broken capability is a 200; the answer IS the payload
    );
  }

  const findings = runRules(r.page, [{ kind: 'no_owner_strings' }, { kind: 'min_contrast', ratio: 3 }]);
  return NextResponse.json({
    ok: true,
    driver: r.driver,
    ms,
    url,
    verdict: 'serverless Chromium rendered — a publish-time gate is feasible in this runtime',
    scanned: r.page.scanned,
    title: r.page.title,
    findings,
    summary: summarize(findings),
  });
}
