// The outreach links on a templates-list row: which exist for which draft, and that both list
// surfaces (table + card grid) mount them.
import fs from 'fs';
import path from 'path';
import { draftOutreachLinks } from '@/lib/outreach/draftLinks';
import { stripComments } from '@/test/stripComments';

const read = (p: string) => stripComments(fs.readFileSync(path.join(process.cwd(), p), 'utf8'));

const base = { templateId: 't1', slug: 'rock-island-pizza-0ll5d', claimSource: 'listing_import', builtFromPost: false, claimToken: 'tok.en', base: 'https://www.quicksites.ai/', menuHost: 'delivered.menu' };

describe('draftOutreachLinks', () => {
  it('a draft built from a prospect WITH a site gets preview, Evolve, postcard and the claim link', () => {
    const l = draftOutreachLinks({ ...base, prospect: { id: 'p1', website: 'https://pizzarockisland.com', postcard_sent_at: '2026-10-10T20:00:00Z', claim_link_visits: 2, claim_link_visited_at: '2026-10-11T01:00:00Z' } })!;
    expect(l.previewUrl).toBe('https://deliveredmenu.com/rock-island-pizza-0ll5d');
    expect(l.evolveUrl).toBe('https://www.quicksites.ai/evolve/p1');
    expect(l.cardFrontUrl).toBe('/api/admin/prospects/evolve-postcard/p1?side=front');
    expect(l.cardBackUrl).toBe('/api/admin/prospects/evolve-postcard/p1?side=back');
    expect(l.claimUrl).toBe('https://www.quicksites.ai/claim-site/t1?token=tok.en');
    expect(l.status).toMatch(/card mailed Oct 10 · link opened 2×/);
  });
  it('a prospect with NO site gets no Evolve and no card — the pitch needs a current site to sit beside', () => {
    const l = draftOutreachLinks({ ...base, prospect: { id: 'p2', website: null } })!;
    expect(l.evolveUrl).toBeNull();
    expect(l.cardFrontUrl).toBeNull();
    expect(l.claimUrl).toContain('/claim-site/t1');
    expect(l.status).toBeNull();
  });
  it('a post build (no prospect) gets the platform preview and the claim link only', () => {
    const l = draftOutreachLinks({ ...base, builtFromPost: true, prospect: null })!;
    expect(l.previewUrl).toBe('https://www.quicksites.ai/sites/rock-island-pizza-0ll5d');
    expect(l.evolveUrl).toBeNull();
    expect(l.builtFromPost).toBe(true);
  });
  it('is null for anything that is not a listing-import draft', () => {
    expect(draftOutreachLinks({ ...base, claimSource: 'guest_build', prospect: null })).toBeNull();
    expect(draftOutreachLinks({ ...base, slug: null, prospect: null })).toBeNull();
  });
});

describe('both list surfaces mount the row, and the API attaches it', () => {
  it.each(['components/admin/templates/templates-index-table.tsx', 'components/admin/templates/templates-card-grid.tsx'])('%s', (f) => {
    expect(read(f)).toMatch(/<DraftOutreachLinksRow links=\{\([tr] as any\)\.outreach\}/);
  });
  it('the list API mints the claim token on the server and attaches outreach', () => {
    const api = read('app/api/admin/templates/list/route.ts');
    expect(api).toMatch(/it\.outreach = draftOutreachLinks\(/);
    expect(api).toMatch(/claimToken: mintSiteClaimToken\(id\)/);
  });
});
