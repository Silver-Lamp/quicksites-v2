/**
 * @jest-environment node
 */
// A link we send someone must be tappable on a phone.
//
// ⚠️ THIS COST US A LIVE EXPERIMENT. Five hand-written cold texts went out carrying the bare
// hostname `<slug>.delivered.menu`. Phones autolink from a TLD list, and the new gTLDs are not on
// it — so the one thing each message existed to deliver arrived as plain unclickable text, hyphen-
// wrapped across four lines. Worse, the phone DID linkify a date ("5 De Mayo") and a street address
// in the same message, so the only tappable things led to a calendar and to Maps.
//
// The code was never wrong: `menuSiteUrl()` has always returned `https://…`. The rule lived in a
// function, and the messages were written by hand in a doc — which is exactly the gap a function
// cannot cover. Hence a test over the prose.
//
// Two things make a link survive: an explicit `https://` scheme (which makes linkification reliable
// regardless of TLD) and, for anything we ask a human to retype, a familiar TLD. We own
// `deliveredmenu.com`, which 301s to `delivered.menu` preserving the path, so both are available at
// no cost.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/** Docs whose blockquotes are messages actually sent to a person. */
const MESSAGE_DOCS = ['docs/OUTREACH_FIVE.md'];

/** A bare hostname on a TLD phones do not autolink. */
const BARE_NEW_GTLD = /(^|[\s(>*_"'])((?:[a-z0-9-]+\.)+(?:menu|ai|app|dev|site|shop|store))\b/gi;

/** Lines inside a `>` blockquote — the message as sent. */
function quotedLines(md: string): Array<{ n: number; text: string }> {
  return md
    .split('\n')
    .map((text, i) => ({ n: i + 1, text }))
    .filter((l) => l.text.startsWith('> '))
    .map((l) => ({ n: l.n, text: l.text.slice(2) }));
}

describe.each(MESSAGE_DOCS)('%s — links we send must be tappable', (rel) => {
  const path = join(process.cwd(), rel);
  const md = existsSync(path) ? readFileSync(path, 'utf8') : '';

  it('exists and contains message blockquotes to check', () => {
    // ⚠️ A scan matching nothing reports success. If the drafts are ever restructured out of
    // blockquotes this fails loudly rather than passing vacuously.
    expect(md).not.toBe('');
    expect(quotedLines(md).length).toBeGreaterThan(10);
  });

  it('never puts a bare new-gTLD hostname in a message', () => {
    const bad: string[] = [];
    for (const { n, text } of quotedLines(md)) {
      for (const m of text.matchAll(BARE_NEW_GTLD)) {
        const host = m[2];
        // Preceded by "://" it is part of a full URL and fine.
        const at = m.index ?? 0;
        if (text.slice(Math.max(0, at - 8), at + 1).includes('://')) continue;
        bad.push(`${rel}:${n}  ${host}  → use https://deliveredmenu.com/<slug>`);
      }
    }
    expect(bad.length === 0 ? 'all tappable' : `bare hostnames will not linkify:\n${bad.join('\n')}`).toBe(
      'all tappable',
    );
  });

  it('every URL in a message carries an explicit scheme', () => {
    const bad: string[] = [];
    for (const { n, text } of quotedLines(md)) {
      for (const m of text.matchAll(/(^|\s)(www\.[^\s)]+)/gi)) {
        bad.push(`${rel}:${n}  ${m[2]}  → prefix https://`);
      }
    }
    expect(bad.length === 0 ? 'all schemed' : bad.join('\n')).toBe('all schemed');
  });
});

describe('the code path was never the problem, and must stay that way', () => {
  // Asserts the SHAPE the function emits, not the exact statement — the first version pinned the
  // whole `return` line and broke on the ternary that was already there, which is a test failing on
  // correct code rather than on a regression.
  it('menuSiteUrl emits an absolute https URL when a menu domain is configured', () => {
    const src = readFileSync(join(process.cwd(), 'lib/menu/deliveredMenu.ts'), 'utf8');
    expect(src).toContain('https://${slug}.${MENU_BASE_DOMAIN}');
  });
});
