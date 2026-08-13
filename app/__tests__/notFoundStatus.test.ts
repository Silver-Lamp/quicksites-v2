/**
 * @jest-environment node
 */
// A 404 must answer 404.
//
// ⚠️ THE WHOLE APP WAS A SOFT 404 AND NOTHING NOTICED. Every `notFound()` in the app returned
// **HTTP 200** with a 404 page in the body — in dev and in production. The minimal case, a page
// whose entire body is `notFound()`, served 200 on quicksites.ai.
//
// The cause was a THREE-LINE FILE: `app/loading.tsx`. A `loading.tsx` wraps its segment's children
// in an automatic Suspense boundary, and at the app root that means every page streams — the shell,
// and with it the 200 status line, is flushed before the page component runs. By the time
// `notFound()` throws there is no status left to change.
//
// It was found chasing something narrower: `kent-restaurant.delivered.menu` answered 200 for a city
// with no directory, as did `deliveredmenu.com/<any-typo>`. Ruled out one at a time — middleware
// (removed it, still 200), the root layout's `force-dynamic` (removed it, still 200) — until the
// root `loading.tsx` was moved aside and three separate routes started answering 404 at once.
//
// Why it matters beyond tidiness: search engines treat 200 as a real page, so every typo and every
// dead outreach link on delivered.menu was an indexable thin page competing with the real ones; and
// any monitoring that checks status codes is blind to the entire class. Same shape as the site
// exporter fetching a clean 200 of our own error page and handing it to a restaurant owner as proof
// they owned their site.
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const APP = join(process.cwd(), 'app');

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (e === 'loading.tsx') out.push(p.slice(APP.length + 1));
  }
  return out;
}

describe('the root loading.tsx stays gone', () => {
  it('does not exist', () => {
    expect(existsSync(join(APP, 'loading.tsx'))).toBe(false);
  });
});

describe('no loading.tsx above a PUBLIC route that calls notFound()', () => {
  // ⚠️ These three are ACCEPTED, not overlooked. All are admin/authenticated surfaces: nothing
  // crawls them, so a soft 404 costs nothing there, and a loading UI in an editor is worth having.
  // The trade-off is only defensible because they are not public — which is exactly what this
  // allowlist pins. Adding a loading.tsx over a public route re-breaks 404s for that whole subtree.
  const ACCEPTED = new Set([
    'admin/inbox/loading.tsx',
    'template/[key]/edit/loading.tsx',
    'admin/templates/[[...slug]]/loading.tsx',
  ]);

  const found = walk(APP);

  it('finds the loading files it is meant to check', () => {
    // A scan matching nothing reports success.
    expect(found.length).toBeGreaterThan(0);
  });

  it('has none outside the accepted admin set', () => {
    const unexpected = found.filter((f) => !ACCEPTED.has(f));
    expect(
      unexpected.length === 0
        ? 'clean'
        : `these wrap pages in Suspense and will make notFound() return 200 beneath them:\n${unexpected.join('\n')}`,
    ).toBe('clean');
  });

  it('every accepted entry is on an admin/editor path, never a public one', () => {
    for (const f of ACCEPTED) {
      expect(f.startsWith('admin/') || f.startsWith('template/')).toBe(true);
    }
  });
});
