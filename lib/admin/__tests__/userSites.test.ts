/**
 * @jest-environment node
 */
// /admin/users must answer "what has this person built?" — the list grew up in the commerce era
// and said nothing about sites, which is what a builder signup actually does.
import { readFileSync } from 'node:fs';
import { summarizeUserSites, authProvider, NO_SITES, LATEST_SITES_PER_USER, type OwnedTemplateRow } from '../userSites';

const row = (over: Partial<OwnedTemplateRow> & { id: string; owner_id: string }): OwnedTemplateRow => ({
  slug: `${over.id}-slug`,
  template_name: `Site ${over.id}`,
  published: false,
  updated_at: '2026-09-10T00:00:00Z',
  created_at: '2026-09-01T00:00:00Z',
  ...over,
});

describe('summarizeUserSites', () => {
  it('counts, splits live vs draft, and finds the newest edit per owner', () => {
    const m = summarizeUserSites([
      row({ id: 'a', owner_id: 'u1', published: true, updated_at: '2026-09-12T10:00:00Z', created_at: '2026-08-30T00:00:00Z', custom_domain: 'a.com' }),
      row({ id: 'b', owner_id: 'u1', updated_at: '2026-09-13T08:00:00Z' }),
      row({ id: 'c', owner_id: 'u2' }),
      row({ id: 'd', owner_id: null as any }),
    ]);
    const u1 = m.get('u1')!;
    expect(u1).toMatchObject({ total: 2, published: 1, drafts: 1, custom_domains: 1, last_edited_at: '2026-09-13T08:00:00Z', first_created_at: '2026-08-30T00:00:00Z' });
    expect(u1.latest.map((s) => s.id)).toEqual(['b', 'a']); // newest edit first
    expect(u1.latest[1].url).toBe('https://a.com'); // custom domain wins over the platform host
    expect(u1.latest[0].url).toBe('https://b-slug.quicksites.ai');
    expect(m.get('u2')!.total).toBe(1);
    expect(m.has('null')).toBe(false); // ownerless rows never become a phantom user
  });
  it('caps the brief list, never the counts', () => {
    const rows = Array.from({ length: 12 }, (_, i) => row({ id: `s${i}`, owner_id: 'u', updated_at: `2026-09-${String(1 + i).padStart(2, '0')}T00:00:00Z` }));
    const s = summarizeUserSites(rows).get('u')!;
    expect(s.total).toBe(12);
    expect(s.latest).toHaveLength(LATEST_SITES_PER_USER);
    expect(s.latest[0].id).toBe('s11');
  });
  it('names a site by business name, then template name, then slug', () => {
    const s = summarizeUserSites([
      row({ id: 'x', owner_id: 'u', business_name: 'Ferry Street Towing', template_name: 'ignored' }),
      row({ id: 'y', owner_id: 'u', business_name: null, template_name: null, slug: 'only-a-slug' }),
    ]).get('u')!;
    expect(s.latest.map((b) => b.name).sort()).toEqual(['Ferry Street Towing', 'only-a-slug']);
  });
  it('NO_SITES is the shape for a user with nothing', () => {
    expect(NO_SITES).toMatchObject({ total: 0, published: 0, drafts: 0, latest: [] });
  });
});

describe('authProvider', () => {
  it('a guest is anonymous whatever the metadata says', () => {
    expect(authProvider({ is_anonymous: true, app_metadata: { provider: 'email' } })).toBe('anonymous');
  });
  it('reads Supabase app metadata', () => {
    expect(authProvider({ app_metadata: { provider: 'google', providers: ['google'] } })).toBe('google');
    expect(authProvider({ app_metadata: { providers: ['email'] } })).toBe('email');
    expect(authProvider({})).toBe('unknown');
  });
});

describe('wired in', () => {
  it('the list API ships is_anonymous / provider / is_admin / sites and honours the two filters', () => {
    const src = readFileSync('app/api/admin/users/list/route.ts', 'utf8');
    for (const k of ['is_anonymous:', 'provider: authProvider(', 'is_admin: adminIds.has(', 'sites: sitesByUser.get(']) expect(src).toContain(k);
    expect(src).toMatch(/searchParams\.get\('builders'\) === '1'/);
    expect(src).toMatch(/searchParams\.get\('guests'\) === 'hide'/);
    expect(src).toMatch(/\.from\('templates'\)[\s\S]*\.in\('owner_id', userIds\)/);
  });
  it('the manager hides guests by default, has a Sites column, and links each site to the editor and its public URL', () => {
    const src = readFileSync('components/admin/users/users-plans-manager.tsx', 'utf8');
    expect(src).toMatch(/useState\(true\);\s*\n\s*const \[buildersOnly/); // hideGuests default true
    expect(src).toMatch(/<SortHead label="Sites" k="sites"/);
    expect(src).toMatch(/href=\{`\/admin\/templates\/\$\{s\.id\}`\}/);
    expect(src).toMatch(/href=\{s\.url\} target="_blank" rel="noopener noreferrer"/);
    expect(src).not.toMatch(/<TableHead>Compliance<\/TableHead>/);
  });
});
