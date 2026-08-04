import { presenterFromSenderProfile } from '../presenter';
import { lastActivityAt } from '../lastActivity';
import type { SenderProfile } from '@/lib/outreach/senderProfile';

const profile = (over: Partial<SenderProfile> = {}): SenderProfile => ({
  name: 'Sandon Jurowski',
  title: 'Founder',
  email: 'sandon@pointsevenstudio.com',
  headshotUrl: 'https://example.test/headshot.webp',
  signatureUrl: 'https://example.test/sig.png',
  city: 'Renton',
  state: 'WA',
  lat: null,
  lng: null,
  ...over,
});

describe('presenterFromSenderProfile', () => {
  it('carries the name, email and headshot', () => {
    expect(presenterFromSenderProfile(profile())).toEqual({
      name: 'Sandon Jurowski',
      email: 'sandon@pointsevenstudio.com',
      headshotUrl: 'https://example.test/headshot.webp',
    });
  });

  it('DROPS the title', () => {
    // Not a detail, and not an oversight to be "fixed" later: the source record is the
    // cold-postcard sender profile, and an outreach-optics title reads as a different claim on a
    // real client's decision page than it does on a mailer. If this assertion ever fails because
    // someone added `title` back, they need to add a field meant for THIS surface instead.
    expect(presenterFromSenderProfile(profile())).not.toHaveProperty('title');
  });

  it('returns null with no name, so the caller renders no identity rather than a blank one', () => {
    expect(presenterFromSenderProfile(profile({ name: null }))).toBeNull();
    expect(presenterFromSenderProfile(profile({ name: '   ' }))).toBeNull();
    expect(presenterFromSenderProfile(null)).toBeNull();
  });

  it('treats blank contact fields as absent, not as empty strings', () => {
    const p = presenterFromSenderProfile(profile({ email: '  ', headshotUrl: '' }));
    expect(p).toEqual({ name: 'Sandon Jurowski', email: null, headshotUrl: null });
  });
});

describe('lastActivityAt', () => {
  it('returns the newest of everything it is given', () => {
    expect(
      lastActivityAt(['2026-08-01T00:00:00Z', '2026-08-03T12:00:00Z', '2026-08-02T00:00:00Z']),
    ).toBe('2026-08-03T12:00:00.000Z');
  });

  it('ignores nulls and unparseable values rather than throwing or returning them', () => {
    expect(lastActivityAt([null, undefined, 'not a date', '2026-08-03T00:00:00Z'])).toBe(
      '2026-08-03T00:00:00.000Z',
    );
  });

  it('returns null when there is nothing to date, so the footer omits the stamp', () => {
    // A "last changed" line with no date behind it would be the page asserting freshness it
    // cannot support — the same failure as an undated menu price.
    expect(lastActivityAt([])).toBeNull();
    expect(lastActivityAt([null, 'nonsense'])).toBeNull();
  });
});
