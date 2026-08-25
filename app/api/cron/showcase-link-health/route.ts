// app/api/cron/showcase-link-health/route.ts
//
// Nightly: are the example sites on the homepage actually alive?
//
// ⚠️ WRITTEN BECAUSE A LINK AUDIT I RAN BY HAND MISSED ONE. On 2026-08-24 I checked every example
// link on the homepage and reported "no 404s" — having only matched `href="https://…"`. The
// showcase also links INTERNALLY, `/sites/<slug>`, and one of those (`ecopest`) was a 404 the whole
// time. Sandon found it. A sweep that silently checks a subset is worse than no sweep, because it
// produces a clean report.
//
// So this checks EVERY internal /sites/ link on the rendered homepage, and it checks them by
// FETCHING them — `ecopest` had published=true, archived=false, rev 44, and simply had no snapshot
// to serve. No database-shaped check would have caught it.
//
// It also flags THIN pages: four entries return 200 with ~230 characters, which is a shell. A 200
// is not proof anyone can read the page.
//
// Alerts admins by email + Sentry when anything is broken, at most once per cooldown window.
import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { runCron } from '@/lib/cron/record';
import { isCronAuthorized } from '@/lib/cron/auth';
import { getSiteSetting, setSiteSetting } from '@/lib/settings/siteSettings';
import { sendEmail } from '@/lib/email';
import { checkAll, sitePathsFrom, summarize, THIN_CHARS } from '@/lib/health/showcaseLinks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // ~90 URLs at concurrency 6

const LAST_SENT_KEY = 'showcase_link_health_last_sent';

async function handle(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  return runCron('showcase-link-health', async () => {
    // ⚠️ NOT `NEXT_PUBLIC_APP_URL`. That variable is unset in Vercel (checked 2026-08-25 — only
    // APP_BASE_URL and QS_PUBLIC_URL exist, both https://www.quicksites.ai), but in this repo's
    // .env.local it is `https://delivered.menu` — the restaurant host. The first cut of this cron
    // used it, fetched the menu directory, found zero /sites/ links and reported a failure. Twelve
    // other call sites read it too; they are safe only because their fallbacks win in production.
    // Prefer the vars that are actually set, and keep the canonical host as the last resort.
    const base = (
      process.env.SHOWCASE_HEALTH_BASE_URL ||
      process.env.APP_BASE_URL ||
      process.env.QS_PUBLIC_URL ||
      'https://www.quicksites.ai'
    ).replace(/\/+$/, '');

    const homeRes = await fetch(`${base}/`, { redirect: 'follow' });
    if (!homeRes.ok) {
      // ⚠️ Fail loudly rather than reporting "0 broken" — an unreachable homepage yields an empty
      // path list, which would otherwise look like a perfect result. Same shape as a grep that
      // matches nothing and reports success (CLAUDE.md §7).
      Sentry.captureMessage(`showcase-link-health: homepage returned ${homeRes.status}`, 'error');
      return NextResponse.json({
        ok: false,
        reason: 'homepage-unreachable',
        status: homeRes.status,
      });
    }
    const paths = sitePathsFrom(await homeRes.text());
    if (paths.length === 0) {
      Sentry.captureMessage('showcase-link-health: homepage exposed 0 /sites/ links', 'error');
      return NextResponse.json({ ok: false, reason: 'no-links-found' });
    }

    const results = await checkAll(base, paths);
    const { total, ok, broken, thin } = summarize(results);

    // ⚠️ THIN ALERTS TOO, NOT JUST BROKEN — otherwise the worst case is the silent one. The first
    // cut only emailed on non-200s. Its first real run found FIVE homepage examples returning 200
    // with 130–250 characters, one of them rendering the literal scaffold copy "Start editing, and
    // let the magic happen." A homepage that says "Built with QuickSites" and links to a page
    // saying "Start editing" is worse than a dead link, and nothing would ever have reported it.
    if (broken.length || thin.length) {
      const cooldownMin = Number(process.env.SHOWCASE_HEALTH_COOLDOWN_MINUTES ?? '720') || 720;
      const last = await getSiteSetting<string | null>(LAST_SENT_KEY, null);
      const due = !last || Date.now() - new Date(last).getTime() > cooldownMin * 60_000;
      const lines = broken.map((b) => `  ${b.status}  ${base}${b.path}`).join('\n');
      const thinLines = thin.map((t) => `  ${t.textLength}c  ${base}${t.path}`).join('\n');
      Sentry.captureMessage(
        `showcase-link-health: ${broken.length} broken, ${thin.length} near-empty homepage example(s)\n` +
          [lines, thinLines].filter(Boolean).join('\n'),
        broken.length ? 'warning' : 'info'
      );
      const to = (process.env.ADMIN_EMAILS ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (due && to.length) {
        const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;');
        const subject = broken.length
          ? `${broken.length} broken example site${broken.length === 1 ? '' : 's'} on the homepage`
          : `${thin.length} near-empty example site${thin.length === 1 ? '' : 's'} on the homepage`;
        await sendEmail({
          to,
          subject,
          html:
            `<p>These are linked from <a href="${base}/">${esc(base)}</a> as examples of what QuickSites builds.</p>` +
            (broken.length
              ? `<p><strong>Broken</strong> — a visitor clicking these gets nothing:</p><pre>${esc(lines)}</pre>`
              : '') +
            (thin.length
              ? `<p><strong>Near-empty</strong> — a 200, but under ${THIN_CHARS} characters of text. ` +
                `An unfinished draft on the homepage reads worse than a dead link:</p><pre>${esc(thinLines)}</pre>`
              : '') +
            `<p>Checked ${total} links · ${ok} healthy.</p>`,
        });
        await setSiteSetting(LAST_SENT_KEY, new Date().toISOString());
      }
    }

    return NextResponse.json({
      ok: true,
      total,
      healthy: ok,
      broken: broken.map((b) => ({ path: b.path, status: b.status })),
      thin: thin.map((t) => ({ path: t.path, chars: t.textLength })),
    });
  });
}

export async function GET(req: NextRequest) {
  return handle(req);
}
export async function POST(req: NextRequest) {
  return handle(req);
}
