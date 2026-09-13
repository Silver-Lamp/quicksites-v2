/**
 * @jest-environment node
 */
// The number that says whether the builder's front door works. On 2026-09-13: 16 · 47 · 7 · 0 · 0 · 0.
import { readFileSync } from 'node:fs';
import { computeGuestFunnel, EMPTY_GUEST_FUNNEL, type GuestTemplateRow, type GuestUserRow } from '../guestFunnel';

const guest = (id: string, over: Partial<GuestUserRow> = {}): GuestUserRow => ({ id, created_at: '2026-09-01T00:00:00Z', last_sign_in_at: '2026-09-01T00:00:00Z', is_anonymous: true, ...over });
const site = (id: string, owner: string, over: Partial<GuestTemplateRow> = {}): GuestTemplateRow => ({ id, owner_id: owner, created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:05:00Z', claim_source: 'guest_build', ...over });

describe('computeGuestFunnel', () => {
  it('counts each stage from the rows', () => {
    const guests = [
      guest('g1'),
      guest('g2', { last_sign_in_at: '2026-09-03T00:00:00Z' }), // came back
      guest('g3', { new_email: 'x@y.com' }), // started sign-up
    ];
    const sites = [
      site('s1', 'g1', { updated_at: '2026-09-01T00:30:00Z', rebuilt_from: 'https://a.com/' }), // engaged, from a URL
      site('s2', 'g2', { has_contact: true }),
      site('s3', 'g3'),
      site('s4', 'converted-owner'), // owner no longer anonymous → converted
      site('s5', 'g1', { claim_source: 'listing_import' }), // not a guest build
    ];
    expect(computeGuestFunnel(guests, sites)).toEqual({
      guests: 3, sites: 4, builders: 4, editedTenMinPlus: 1, returned: 1, startedSignup: 1, converted: 1,
      withSourceUrl: 1, withContact: 1, newestSiteAt: '2026-09-01T00:00:00Z',
    });
  });
  it('an empty world is the empty funnel', () => {
    expect(computeGuestFunnel([], [])).toEqual(EMPTY_GUEST_FUNNEL);
  });
  it('the engagement threshold is ten minutes, measured on the site not the session', () => {
    const g = [guest('g')];
    expect(computeGuestFunnel(g, [site('a', 'g', { updated_at: '2026-09-01T00:09:59Z' })]).editedTenMinPlus).toBe(0);
    expect(computeGuestFunnel(g, [site('a', 'g', { updated_at: '2026-09-01T00:10:00Z' })]).editedTenMinPlus).toBe(1);
  });
});

describe('wired into the ops dashboard', () => {
  it('the snapshot carries guestFunnel and the dashboard renders every stage with a link to /admin/users', () => {
    const snap = readFileSync('lib/ops/opsSnapshotServer.ts', 'utf8');
    expect(snap).toMatch(/guestFunnel: GuestFunnel/);
    expect(snap).toMatch(/loadGuestFunnel\(\)/);
    const ui = readFileSync('components/admin/ops-dashboard-client.tsx', 'utf8');
    for (const label of ['Guests', 'Edited 10+ min', 'Came back', 'Started sign-up', 'Converted', 'Reachable']) expect(ui).toContain(`label="${label}"`);
    expect(ui).toMatch(/href="\/admin\/users"/);
    expect(ui).toMatch(/npm run guests:contacts/);
  });
  it('the loader never throws — the dashboard renders with an empty funnel instead', () => {
    const src = readFileSync('lib/admin/guestFunnelServer.ts', 'utf8');
    expect(src).toMatch(/catch[\s\S]*return EMPTY_GUEST_FUNNEL/);
  });
});
