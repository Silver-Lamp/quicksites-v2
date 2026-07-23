/**
 * @jest-environment node
 */
// lib/outreach/__tests__/competitionPoster.test.ts

import {
  claimDeadlineLabel,
  renderPosterHtml,
  renderPosterBackHtml,
  trackedClaimUrl,
  postcardBenefits,
  resolveLocalityLine,
  senderFromProfile,
  type PosterModel,
} from '@/lib/outreach/competitionPoster';
import type { SenderProfile } from '@/lib/outreach/senderProfile';

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

  it('renders concrete benefit bullets when provided', () => {
    const html = renderPosterBackHtml({ ...base, benefits: postcardBenefits('restaurant') });
    expect(html).toContain('order online');
    expect(html).toContain('<ul class="benefits">');
    // Exactly the three bullets, no more.
    expect((html.match(/<li>/g) ?? []).length).toBe(3);
  });

  it('renders a human sign-off (headshot + signature + name) over the org team line', () => {
    const html = renderPosterBackHtml({
      ...base,
      brandName: 'CedarSites',
      sender: { name: 'Sandon Jurowski', title: 'Founder', headshotUrl: 'https://x/face.jpg', signatureUrl: 'https://x/sig.png' },
    });
    expect(html).toContain('— Sandon Jurowski, Founder');
    expect(html).toContain('src="https://x/face.jpg"');
    expect(html).toContain('src="https://x/sig.png"');
    // The personal sign-off replaces the generic team line.
    expect(html).not.toContain('The CedarSites team');
  });

  it('prints a "Questions?" contact email when the sender has one', () => {
    const html = renderPosterBackHtml({ ...base, sender: { name: 'Sandon Jurowski', email: 'sandon@pointsevenstudio.com' } });
    expect(html).toContain('Questions? sandon@pointsevenstudio.com');
  });

  it('shows the local city+state on both faces when the sender is local', () => {
    const model = { ...base, localLine: 'Renton, WA' };
    expect(renderPosterHtml(model)).toContain('Renton, WA');
    expect(renderPosterBackHtml(model)).toContain('Renton, WA');
  });
});

describe('postcardBenefits', () => {
  it('is food-forward for restaurants', () => {
    expect(postcardBenefits('restaurant')[0]).toMatch(/order online/i);
  });
  it('is commerce-forward for makers/retail', () => {
    expect(postcardBenefits('author').join(' ')).toMatch(/sell your products/i);
  });
  it('falls back to a service pitch for trades', () => {
    expect(postcardBenefits('towing').join(' ')).toMatch(/find you first|one tap/i);
  });
  it('leads with the SecondSet transparency wedge for auto service', () => {
    expect(postcardBenefits('auto_repair').join(' ')).toMatch(/photo|actual problem|approve the work/i);
    expect(postcardBenefits('windshield_repair')).toHaveLength(3);
  });
  it('always returns exactly three bullets', () => {
    for (const k of ['restaurant', 'author', 'towing', 'auto_repair', 'other'] as const) {
      expect(postcardBenefits(k)).toHaveLength(3);
    }
  });
});

describe('senderFromProfile', () => {
  const profile: SenderProfile = {
    name: 'Sandon Jurowski', title: 'Founder', email: 'sandon@pointsevenstudio.com',
    headshotUrl: 'https://x/face.jpg', signatureUrl: 'https://x/sig.png',
    city: 'Renton', state: 'WA', lat: 47.48, lng: -122.2,
  };

  it('maps a profile to a postcard sender for the default brand', () => {
    expect(senderFromProfile(profile, null)).toMatchObject({
      name: 'Sandon Jurowski', title: 'Founder', email: 'sandon@pointsevenstudio.com',
    });
  });

  it('is suppressed for reseller/branded sends (never stamps the operator on a partner card)', () => {
    expect(senderFromProfile(profile, 'CedarSites')).toBeNull();
  });

  it('is null when the profile has no name', () => {
    expect(senderFromProfile({ ...profile, name: null }, null)).toBeNull();
  });
});

describe('resolveLocalityLine', () => {
  const seattle = { senderCity: 'Renton', senderState: 'WA', senderLat: 47.48, senderLng: -122.2 };

  it('is local in the same state regardless of distance', () => {
    expect(
      resolveLocalityLine({ ...seattle, targetState: 'wa', targetLat: null, targetLng: null }),
    ).toBe('Renton, WA');
  });

  it('is local across a state line within the radius', () => {
    // Portland, OR — ~145mi from Renton, different state, inside 300mi.
    expect(
      resolveLocalityLine({ ...seattle, targetState: 'OR', targetLat: 45.52, targetLng: -122.68 }),
    ).toBe('Renton, WA');
  });

  it('is NOT local across a state line beyond the radius', () => {
    // Boston, MA — cross-country, well beyond 300mi.
    expect(
      resolveLocalityLine({ ...seattle, targetState: 'MA', targetLat: 42.36, targetLng: -71.06 }),
    ).toBeNull();
  });

  it('respects a custom radius', () => {
    expect(
      resolveLocalityLine({ ...seattle, targetState: 'OR', targetLat: 45.52, targetLng: -122.68, radiusMiles: 50 }),
    ).toBeNull();
  });

  it('returns null when the sender location is unconfigured', () => {
    expect(
      resolveLocalityLine({ senderCity: null, senderState: null, senderLat: null, senderLng: null, targetState: 'WA', targetLat: null, targetLng: null }),
    ).toBeNull();
  });
});
