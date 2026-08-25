import { sitePathsFrom, verdictFor, visibleText, summarize, THIN_CHARS } from '../showcaseLinks';

describe('sitePathsFrom', () => {
  // ⚠️ THE REGRESSION THIS EXISTS FOR. A hand audit matched only href="https://…" and reported
  // "no 404s" on the homepage while /sites/ecopest was dead. Internal links are the ones a
  // showcase actually uses, and they were the ones not being checked.
  it('finds internal /sites/ links, which an external-only sweep misses', () => {
    const html = `
      <a href="https://covingtontow.com">ext</a>
      <a href="/sites/ecopest">demo</a>
      <a href="/sites/starter-towing">demo</a>`;
    expect(sitePathsFrom(html)).toEqual(['/sites/ecopest', '/sites/starter-towing']);
  });

  it('dedupes and ignores fragments and queries', () => {
    const html = `<a href="/sites/a">1</a><a href="/sites/a">2</a><a href="/sites/b#x">3</a>`;
    expect(sitePathsFrom(html)).toEqual(['/sites/a']);
  });

  it('returns nothing when there is nothing — the caller must treat that as a failure', () => {
    expect(sitePathsFrom('<p>no links</p>')).toEqual([]);
  });
});

describe('verdictFor', () => {
  // ⚠️ A 200 IS NOT PROOF A VISITOR SEES A SITE. Four homepage entries return 200 with ~230
  // characters. Status-only checking would call all four healthy.
  it('calls a 200 with almost no text thin, not ok', () => {
    expect(verdictFor(200, 229)).toBe('thin');
    expect(verdictFor(200, THIN_CHARS - 1)).toBe('thin');
    expect(verdictFor(200, THIN_CHARS)).toBe('ok');
  });

  it('treats any non-200 and any transport error as broken', () => {
    expect(verdictFor(404, 0)).toBe('broken');
    expect(verdictFor(500, 9999)).toBe('broken');
    expect(verdictFor('ERR', 0)).toBe('broken');
  });
});

describe('visibleText', () => {
  it('measures what a reader gets, not the markup', () => {
    const html = `<html><head><style>.a{color:red}</style><script>var x=1;</script></head>
      <body><h1>Renton Towing</h1><p>Fast   help</p></body></html>`;
    const t = visibleText(html);
    expect(t).toContain('Renton Towing');
    expect(t).not.toContain('color:red');
    expect(t).not.toContain('var x');
    expect(t).not.toMatch(/\s{2,}/);
  });
});

describe('summarize', () => {
  it('separates broken from thin so an alert can say which is which', () => {
    const s = summarize([
      { path: '/sites/a', status: 200, textLength: 900, verdict: 'ok' },
      { path: '/sites/b', status: 404, textLength: 0, verdict: 'broken' },
      { path: '/sites/c', status: 200, textLength: 200, verdict: 'thin' },
    ]);
    expect(s).toMatchObject({ total: 3, ok: 1 });
    expect(s.broken.map((b) => b.path)).toEqual(['/sites/b']);
    expect(s.thin.map((t) => t.path)).toEqual(['/sites/c']);
  });
});
