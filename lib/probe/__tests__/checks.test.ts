// lib/probe/__tests__/checks.test.ts
//
// The probe must be able to FAIL, and fail for the stated reason. A green check that cannot go red
// is the same silence-looks-like-success failure it was built to catch.
import { countElement, visibleText, sniffImage, evaluateHtml, evaluateImage } from '@/lib/probe/checks';
import type { Check } from '@/lib/probe/checks';

const base: Check = { name: 't', url: 'https://example.test', because: 'test' };

describe('sniffImage — bytes, never the header', () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
  const svg = new Uint8Array([...'<svg xmlns="x">'].map((c) => c.charCodeAt(0)));

  it('identifies real formats', () => {
    expect(sniffImage(png)).toBe('png');
    expect(sniffImage(jpeg)).toBe('jpeg');
    expect(sniffImage(svg)).toBe('svg');
  });

  // The exact bug: a route declaring SVG while serving PNG. The header agrees with nothing.
  it('catches a declared type that contradicts the bytes', () => {
    const fails = evaluateImage({ ...base, expectImage: 'png' }, png, 'image/svg+xml');
    expect(fails.join(' ')).toMatch(/declared "image\/svg\+xml" but bytes are png/);
  });

  it('passes when the declaration is honest', () => {
    expect(evaluateImage({ ...base, expectImage: 'png' }, png, 'image/png')).toEqual([]);
  });
});

describe('evaluateHtml — the wrong-body-under-200 class', () => {
  it('fails on forbidden text even though the page "worked"', () => {
    const check = { ...base, mustNotContain: ['recognise that code'] };
    const fails = evaluateHtml(check, '<html><body>We don’t recognise that code</body></html>');
    expect(fails).toHaveLength(1);
    expect(fails[0]).toMatch(/forbidden text/);
  });

  it('fails on an empty shell — the tenant-site failure', () => {
    const check = { ...base, minElements: { h1: 1, a: 3 }, minTextChars: 400 };
    const fails = evaluateHtml(check, '<html><body><div id="root"></div></body></html>');
    expect(fails.join(' ')).toMatch(/only 0 <h1>/);
    expect(fails.join(' ')).toMatch(/only 0 <a>/);
    expect(fails.join(' ')).toMatch(/chars of visible text/);
  });

  it('passes a real server-rendered page', () => {
    const html = `<html><body><h1>Renton Lemonade</h1>${'<a href="/x">link</a>'.repeat(4)}<p>${'x'.repeat(500)}</p></body></html>`;
    expect(evaluateHtml({ ...base, minElements: { h1: 1, a: 3 }, minTextChars: 400 }, html)).toEqual([]);
  });
});

describe('the counting helpers do not lie', () => {
  // ⚠️ Regression guard for a real mistake made while building this: a shell-quoting bug made the
  // element counts read 0 for a page that plainly had an h1, which is BYTE-IDENTICAL to the
  // signature of the empty-shell bug. A broken instrument produced a plausible false alarm about
  // the exact failure being hunted.
  it('counts elements that are present', () => {
    const html = '<h1 class="x">A</h1><h2>B</h2><p>c</p><p>d</p><a href="#">e</a>';
    expect(countElement(html, 'h1')).toBe(1);
    expect(countElement(html, 'p')).toBe(2);
    expect(countElement(html, 'a')).toBe(1);
  });

  it('does not count a tag that merely appears inside another name', () => {
    expect(countElement('<article>x</article>', 'a')).toBe(0);
  });

  it('strips scripts so inline JS is not mistaken for page text', () => {
    const t = visibleText('<script>var a="hello there friend";</script><p>Real</p>');
    expect(t).toBe('Real');
  });
});
