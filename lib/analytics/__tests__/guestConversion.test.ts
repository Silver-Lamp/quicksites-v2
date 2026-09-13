/**
 * @jest-environment node
 */
// The event the guest→signup fix is measured by. SIGNUP keys on account age and never fires for
// a converted guest, whose account predates the confirmation by however long they built.
import { readFileSync } from 'node:fs';
import { captureGuestConversionIfFresh, isFreshGuestConfirmation, CONFIRMATION_FRESHNESS_MS, MIN_GUEST_AGE_BEFORE_CONFIRM_MS } from '../guestConversion';
import { EVENTS } from '../events';

const NOW = Date.parse('2026-09-13T12:00:00Z');
const at = (msAgo: number) => new Date(NOW - msAgo).toISOString();

describe('isFreshGuestConfirmation', () => {
  it('a guest who built for an hour and just confirmed → yes', () => {
    expect(isFreshGuestConfirmation({ id: 'u', email: 'a@b.co', is_anonymous: false, created_at: at(3600_000), email_confirmed_at: at(10_000) }, NOW)).toBe(true);
  });
  it('a fresh email signup (created and confirmed seconds apart) → no, that is SIGNUP', () => {
    expect(isFreshGuestConfirmation({ id: 'u', email: 'a@b.co', is_anonymous: false, created_at: at(20_000), email_confirmed_at: at(10_000) }, NOW)).toBe(false);
  });
  it('a later login by a converted guest → no (confirmation is not fresh)', () => {
    expect(isFreshGuestConfirmation({ id: 'u', email: 'a@b.co', is_anonymous: false, created_at: at(86_400_000), email_confirmed_at: at(CONFIRMATION_FRESHNESS_MS + 1000) }, NOW)).toBe(false);
  });
  it('still anonymous, no email, or missing timestamps → no', () => {
    expect(isFreshGuestConfirmation({ id: 'u', email: null, is_anonymous: false, created_at: at(3600_000), email_confirmed_at: at(1000) }, NOW)).toBe(false);
    expect(isFreshGuestConfirmation({ id: 'u', email: 'a@b.co', is_anonymous: true, created_at: at(3600_000), email_confirmed_at: at(1000) }, NOW)).toBe(false);
    expect(isFreshGuestConfirmation({ id: 'u', email: 'a@b.co', is_anonymous: false, created_at: null, email_confirmed_at: at(1000) }, NOW)).toBe(false);
    expect(isFreshGuestConfirmation(null, NOW)).toBe(false);
  });
  it('the guest-age floor is what separates the two signup shapes', () => {
    const edge = { id: 'u', email: 'a@b.co', is_anonymous: false, email_confirmed_at: at(1000) };
    expect(isFreshGuestConfirmation({ ...edge, created_at: at(1000 + MIN_GUEST_AGE_BEFORE_CONFIRM_MS) }, NOW)).toBe(true);
    expect(isFreshGuestConfirmation({ ...edge, created_at: at(1000 + MIN_GUEST_AGE_BEFORE_CONFIRM_MS - 1) }, NOW)).toBe(false);
  });
});

describe('captureGuestConversionIfFresh', () => {
  const fresh = { id: 'u', email: 'a@b.co', is_anonymous: false, created_at: at(3600_000), email_confirmed_at: at(10_000) };
  it('fires only when the shape is fresh AND the user owns a guest-built site', async () => {
    expect(await captureGuestConversionIfFresh(fresh, async () => true, NOW)).toBe(true);
    expect(await captureGuestConversionIfFresh(fresh, async () => false, NOW)).toBe(false);
    expect(await captureGuestConversionIfFresh({ ...fresh, is_anonymous: true }, async () => true, NOW)).toBe(false);
  });
  it('does not ask the DB when the shape already says no', async () => {
    let asked = 0;
    await captureGuestConversionIfFresh({ ...fresh, email: null }, async () => { asked++; return true; }, NOW);
    expect(asked).toBe(0);
  });
});

describe('wired into both auth landing routes, best-effort', () => {
  it('callback (code exchange) and set-session (fragment tokens) both capture it inside a try', () => {
    for (const f of ['app/auth/callback/route.ts', 'app/api/auth/set-session/route.ts']) {
      const src = readFileSync(f, 'utf8');
      expect(src).toMatch(/try \{ await captureGuestConversionIfFresh\(data\.user\); \} catch \{\}/);
    }
    expect(EVENTS.GUEST_SIGNUP_CONFIRMED).toBe('guest_signup_confirmed');
  });
});
