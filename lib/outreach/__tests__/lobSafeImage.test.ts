/**
 * @jest-environment node
 */
// Lob prints PNG and JPEG. A WebP headshot printed as a broken-image circle on every proof.
import { readFileSync } from 'node:fs';
import { isLobSafeImageUrl, lobSafeCopyPath } from '../lobSafeImage';
import { senderFromProfile } from '../competitionPoster';
import type { SenderProfile } from '../senderProfile';

const WEBP = 'https://x.supabase.co/storage/v1/object/public/templates/sender-profile/headshot/abc.webp';
const PNG = 'https://x.supabase.co/storage/v1/object/public/templates/sender-profile/signature/def.png';

describe('isLobSafeImageUrl', () => {
  it('accepts png / jpg / jpeg (with a query string) and PNG/JPEG data URLs', () => {
    for (const u of [PNG, 'https://a/b.jpg', 'https://a/b.JPEG?v=2', 'https://a/b.png?token=x#f', 'data:image/png;base64,iVBOR', 'data:image/jpeg;base64,/9j/']) {
      expect(isLobSafeImageUrl(u)).toBe(true);
    }
  });
  it('rejects webp, avif, gif, svg, relative paths, and empties', () => {
    for (const u of [WEBP, 'https://a/b.avif', 'https://a/b.gif', 'https://a/b.svg', '/uploads/face.png', 'face.png', '', null, undefined, 'data:image/webp;base64,UklG']) {
      expect(isLobSafeImageUrl(u)).toBe(false);
    }
  });
});

describe('the last gate before paper', () => {
  const profile: SenderProfile = { name: 'Sandon', title: 'Founder', email: 's@x.com', headshotUrl: WEBP, signatureUrl: PNG, city: 'Renton', state: 'WA', lat: null, lng: null };
  it('senderFromProfile drops a non-Lob-safe image and keeps a safe one', () => {
    const s = senderFromProfile(profile, null)!;
    expect(s.headshotUrl).toBeNull();
    expect(s.signatureUrl).toBe(PNG);
    expect(s.name).toBe('Sandon');
  });
});

describe('the profile save converts', () => {
  it('setSenderProfile runs every image through ensureLobSafeImageUrl (injectable)', () => {
    const src = readFileSync('lib/outreach/senderProfile.ts', 'utf8');
    expect(src).toMatch(/ensureImage\(headshotUrl, 'headshot'\)/);
    expect(src).toMatch(/ensureImage\(signatureUrl, 'signature'\)/);
    expect(src).toMatch(/= ensureLobSafeImageUrl/);
  });
  it('the PNG copy lands at a deterministic path so a re-save overwrites, not accumulates', () => {
    expect(lobSafeCopyPath(WEBP, 'headshot')).toBe(lobSafeCopyPath(WEBP, 'headshot'));
    expect(lobSafeCopyPath(WEBP, 'headshot')).toMatch(/^sender-profile\/lob\/headshot\/[0-9a-f]{16}\.png$/);
    expect(lobSafeCopyPath(WEBP, 'headshot')).not.toBe(lobSafeCopyPath(PNG, 'headshot'));
  });
});
