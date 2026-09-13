/**
 * @jest-environment node
 */
// The apology card promises nothing — an apology that pitches is a pitch. Same forbidden list as
// the claim card, plus the things only this card could get wrong: it must say THEY built it, and
// its QR must be the tracked guest link, never a bearer token.
import { readFileSync } from 'node:fs';
import { renderGuestApologyFront, renderGuestApologyBack, trackedGuestClaimUrl, type GuestApologyModel } from '../guestApologyCard';

const FORBIDDEN: Array<[RegExp, string]> = [
  [/\brank(s|ing|ed)?\b/i, 'a ranking claim'],
  [/page one|page 1|#1\b/i, 'a page-one claim'],
  [/\bgoogle\b/i, 'a search-engine claim'],
  [/24\s*\/\s*7/i, 'an availability claim about the business'],
  [/licens|insured/i, 'a regulatory claim about the business'],
  [/guarantee/i, 'a guarantee'],
  [/competitor|before someone else|goes to one/i, 'the competition mechanic'],
  [/claim by|deadline|expires|only \d+ (days|left)/i, 'invented urgency'],
  [/\$\s?\d/, 'a printed price'],
];

const model: GuestApologyModel = {
  businessName: 'Adze Media',
  siteUrl: 'https://adze-media.quicksites.ai',
  claimUrl: 'https://www.quicksites.ai/go/guest/11111111-2222-4333-8444-555555555555',
  qrDataUrl: 'data:image/png;base64,AAAA',
  sender: { name: 'Sandon Jurowski', title: 'Founder', email: 'sandon@quicksites.ai', headshotUrl: 'https://x/h.png', signatureUrl: 'https://x/s.png', bookingUrl: 'https://calendly.com/quicksites' },
  contactEmail: 'sandon@quicksites.ai',
};

describe('the apology card promises nothing', () => {
  const front = renderGuestApologyFront(model);
  const back = renderGuestApologyBack(model);
  it.each(FORBIDDEN)('never contains %s', (re) => {
    expect(front).not.toMatch(re);
    expect(back).not.toMatch(re);
  });
  it('says THEY built it and owns the failure', () => {
    expect(front).toMatch(/You built <b>Adze Media<\/b> a website/);
    expect(front).toMatch(/That was our fault, not yours/);
    expect(back).toMatch(/Sorry about that/);
    expect(front).not.toMatch(/We built/);
  });
  it('carries the site host, the exit line, the sender, and the tracked link — never a token', () => {
    expect(front).toContain('adze-media.quicksites.ai');
    expect(front).toMatch(/Say the word and it’s gone/);
    expect(back).toContain('https://www.quicksites.ai/go/guest/11111111-2222-4333-8444-555555555555');
    expect(back).not.toMatch(/token=/);
    expect(back).toMatch(/Sandon Jurowski, Founder/);
    expect(back).toMatch(/Prefer to talk\? Book 15 minutes: calendly\.com\/quicksites/);
    expect(front).toContain('data:image/png;base64,AAAA');
  });
  it('is the landscape card Lob prints, with positioned edges', () => {
    expect(front).toMatch(/width:9\.25in; height:6\.25in/);
    expect(back).toMatch(/width:9\.25in; height:6\.25in/);
    expect(front).toMatch(/\.fine \{ position:absolute/);
    expect(back).toMatch(/\.sender \{ position:absolute/);
  });
  it('the printed link is /go/guest/<templateId> on the platform host', () => {
    expect(trackedGuestClaimUrl('abc', 'https://www.quicksites.ai/')).toBe('https://www.quicksites.ai/go/guest/abc');
  });
});

describe('the tracked guest link', () => {
  const src = readFileSync('app/go/guest/[templateId]/route.ts', 'utf8');
  it('only serves guest_build drafts, mints the claim cookie server-side from the row\'s anon owner, and sends the visitor to sign up with the editor as next', () => {
    expect(src).toMatch(/claim_source !== 'guest_build'/);
    expect(src).toMatch(/mintClaimToken\(t\.id, t\.owner_id\)/);
    expect(src).toMatch(/\/login\?next=\$\{encodeURIComponent\(next\)\}/);
    expect(src).toMatch(/httpOnly: true/);
  });
  it('once the owner is no longer a guest, the same link goes to the site', () => {
    expect(src).toMatch(/if \(!stillGuest\)[\s\S]{0,120}publicSiteUrl\(/);
  });
});

describe('the postcard route: one card, one confirmed address, real key only', () => {
  const src = readFileSync('app/api/admin/guests/postcard/route.ts', 'utf8');
  it('is admin-gated, refuses a test key for a real send, preflights the site, and takes ONE address (no bulk)', () => {
    expect(src).toMatch(/getAdminUser\(\)/);
    expect(src).toMatch(/if \(!isTest && lobKeyIsTest\(\)\)/);
    expect(src).toMatch(/preflightSiteUrl\(siteUrl\)/);
    expect(src).not.toMatch(/\.in\('id'|forEach|for \(const .* of .*leads/);
    expect(src).toMatch(/kind: 'guest_apology'/);
  });
});

describe('the ops panel', () => {
  const src = readFileSync('components/admin/ops/guest-leads-panel.tsx', 'utf8');
  it('mailto: and sms: links carry no body — a person writes the message', () => {
    expect(src).toMatch(/mailto:\$\{email\}\?subject=/);
    expect(src).not.toMatch(/mailto:[^`]*body=/);
    expect(src).toMatch(/sms:\$\{phone/);
    expect(src).not.toMatch(/sms:[^`]*body=/);
  });
  it('a Places candidate PREFILLS the postcard form; it never sends on its own', () => {
    expect(src).toMatch(/Prefilled from the Places candidate/);
    expect(src).toMatch(/window\.confirm\(/);
  });
  it('the Reachable tile lives with its panel and is what the dashboard renders', () => {
    expect(src).toMatch(/label="Reachable"/);
    expect(readFileSync('components/admin/ops-dashboard-client.tsx', 'utf8')).toMatch(/<GuestReachableTile funnel=\{guestFunnel\} \/>/);
  });
});
