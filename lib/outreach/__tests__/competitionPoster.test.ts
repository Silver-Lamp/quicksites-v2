/**
 * @jest-environment node
 */
// lib/outreach/__tests__/competitionPoster.test.ts

import {
  claimDeadlineLabel,
  renderPosterHtml,
  renderPosterBackHtml,
  trackedClaimUrl,
  type PosterModel,
} from '@/lib/outreach/competitionPoster';

const base: PosterModel = {
  domain: 'boston-towing.com',
  industryLabel: 'Towing',
  city: 'Boston',
  region: 'MA',
  businesses: ['Ace Towing', 'Bay State Towing', 'Harbor Hook & Tow'],
  claimUrl: 'https://quicksites.ai/r/abc?p=xyz',
  qrDataUrl: 'data:image/png;base64,QQ==',
};

describe('claimDeadlineLabel', () => {
  // Local noon so adding whole days never crosses a day boundary under any timezone.
  const from = new Date(2026, 6, 12, 12, 0, 0); // Jul 12 2026, local
  it('formats a short US date N days out', () => {
    expect(claimDeadlineLabel(14, from)).toBe('Jul 26');
    expect(claimDeadlineLabel(30, from)).toBe('Aug 11');
  });
});

describe('renderPosterHtml (front)', () => {
  it('keeps the generic look when no recipient/deadline is set (backward compatible)', () => {
    const html = renderPosterHtml(base);
    expect(html).toContain('72-HOUR OFFERING');
    expect(html).not.toContain('class="biz you"');
    expect(html).not.toContain('(you)');
  });

  it('highlights the recipient and moves them to the top of the list', () => {
    const html = renderPosterHtml({ ...base, recipientName: 'Bay State Towing' });
    expect(html).toContain('class="biz you"');
    expect(html).toContain('(you)');
    // Recipient row renders before the other businesses.
    expect(html.indexOf('Bay State Towing')).toBeLessThan(html.indexOf('Ace Towing'));
  });

  it('renders a concrete deadline badge instead of the vague one', () => {
    const html = renderPosterHtml({ ...base, deadline: 'Jul 26' });
    expect(html).toContain('CLAIM BY JUL 26');
    expect(html).not.toContain('72-HOUR OFFERING');
  });

  it('escapes recipient names', () => {
    const html = renderPosterHtml({ ...base, businesses: ['A & B <Towing>'], recipientName: 'A & B <Towing>' });
    expect(html).toContain('A &amp; B &lt;Towing&gt;');
    expect(html).not.toContain('<Towing>');
  });
});

describe('org branding on the postcard', () => {
  it('shows a "Built by" wordmark on the front and a sign-off on the back when branded', () => {
    const front = renderPosterHtml({ ...base, brandName: 'CedarSites' });
    const back = renderPosterBackHtml({ ...base, brandName: 'CedarSites' });
    expect(front).toContain('Built by CedarSites');
    expect(back).toContain('The CedarSites team');
  });

  it('shows no wordmark when unbranded (QuickSites default look unchanged)', () => {
    const front = renderPosterHtml(base);
    const back = renderPosterBackHtml(base);
    expect(front).not.toContain('Built by');
    expect(back).not.toContain('team');
  });

  it('serves tracked links on a provided org base domain', () => {
    expect(trackedClaimUrl('camp1', 'p1', 'https://cedarsites.com')).toBe('https://cedarsites.com/r/camp1?p=p1');
    expect(trackedClaimUrl('camp1')).toMatch(/\/r\/camp1$/); // default base, no prospect
  });
});

describe('renderPosterBackHtml (message side)', () => {
  it('greets the recipient by name and shows the deadline', () => {
    const html = renderPosterBackHtml({ ...base, recipientName: 'Bay State Towing', deadline: 'Jul 26' });
    expect(html).toContain('Hi Bay State Towing,');
    expect(html).toContain('Claim by');
    expect(html).toContain('Jul 26');
  });

  it('falls back to a neutral greeting with no recipient', () => {
    const html = renderPosterBackHtml(base);
    expect(html).toContain('Hello,');
    expect(html).not.toContain('Claim by');
  });
});
