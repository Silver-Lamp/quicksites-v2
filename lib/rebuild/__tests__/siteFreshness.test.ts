/**
 * @jest-environment node
 */
// lib/rebuild/__tests__/siteFreshness.test.ts
//
// The "dated site" scorer that decides the 'dated' vs 'has_site' lead tier.

import { scoreFreshnessFromHtml, scoreSiteFreshness } from '@/lib/rebuild/siteFreshness';

const NOW = new Date('2026-07-11T00:00:00Z');

const MODERN = `<!doctype html><html><head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta property="og:title" content="Joe's Pizza">
  </head><body><h1>Joe's Pizza</h1><p>© 2026 Joe's Pizza</p></body></html>`;

const DATED = `<html><head><meta name="generator" content="Adobe Muse 2015"></head>
  <body><table><tr><td><font>Welcome</font></td></tr></table>
  <table></table><table></table>
  <p>Copyright 2009 Old Diner</p></body></html>`;

describe('scoreFreshnessFromHtml', () => {
  it('scores a modern, https, responsive page as has_site', () => {
    const r = scoreFreshnessFromHtml(MODERN, 'https://joes.example', NOW);
    expect(r.tier).toBe('has_site');
    expect(r.score).toBe(100);
    expect(r.signals).toEqual([]);
  });

  it('flags a no-viewport, http, table-layout, stale-copyright page as dated', () => {
    const r = scoreFreshnessFromHtml(DATED, 'http://olddiner.example', NOW);
    expect(r.tier).toBe('dated');
    expect(r.signals).toEqual(
      expect.arrayContaining([
        expect.stringContaining('mobile viewport'),
        expect.stringContaining('HTTPS'),
        expect.stringContaining('Copyright stuck at 2009'),
      ]),
    );
  });

  it('does not flag a recent copyright year', () => {
    const html = `<html><head><meta name="viewport" content="width=device-width"><meta property="og:x" content="y"></head><body>© 2025</body></html>`;
    const r = scoreFreshnessFromHtml(html, 'https://x.example', NOW);
    expect(r.signals.join(' ')).not.toContain('Copyright');
  });
});

describe('scoreSiteFreshness', () => {
  it('treats an unreachable site as has_site (never manufactures a lead)', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error('network down'));
    const r = await scoreSiteFreshness('https://unreachable.example', fetchImpl as unknown as typeof fetch);
    expect(r).toMatchObject({ tier: 'has_site', reachable: false });
  });

  it('scores fetched HTML and marks it reachable', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      url: 'https://joes.example',
      headers: { get: () => 'text/html; charset=utf-8' },
      text: async () => MODERN,
    } as unknown as Response);
    const r = await scoreSiteFreshness('https://joes.example', fetchImpl as unknown as typeof fetch);
    expect(r).toMatchObject({ tier: 'has_site', reachable: true, score: 100 });
  });
});
