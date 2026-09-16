/**
 * @jest-environment node
 */
// lib/admin/__tests__/userIdentity.test.ts
import fs from 'node:fs';
import path from 'node:path';
import { resolveUserIdentity } from '@/lib/admin/userIdentity';

describe('resolveUserIdentity', () => {
  it('prefers the name the account typed, then profile, merchant, chef, site — and says which', () => {
    expect(resolveUserIdentity({ metaName: 'John', profileName: 'Other' })).toMatchObject({ name: 'John', name_source: 'account' });
    expect(resolveUserIdentity({ metaFullName: ' Jane  Doe ' })).toMatchObject({ name: 'Jane Doe', name_source: 'account' });
    expect(resolveUserIdentity({ profileName: 'Sam' })).toMatchObject({ name: 'Sam', name_source: 'profile' });
    expect(resolveUserIdentity({ merchantName: 'Acme Meals' })).toMatchObject({ name: 'Acme Meals', name_source: 'merchant' });
    expect(resolveUserIdentity({ chefName: 'Chef Lu' })).toMatchObject({ name: 'Chef Lu', name_source: 'chef' });
    expect(resolveUserIdentity({ siteBusinessName: '指纹科技HICUSTOM' })).toMatchObject({ name: '指纹科技HICUSTOM', name_source: 'site' });
  });

  it('treats blanks and one-character strings as missing', () => {
    expect(resolveUserIdentity({ metaName: ' ', profileName: 'x', siteBusinessName: 'Real Co' })).toMatchObject({ name: 'Real Co', name_source: 'site' });
    expect(resolveUserIdentity({})).toEqual({ name: null, name_source: null, email: null, email_source: null });
  });

  it('falls back to the profile email for an account without one, lower-cased', () => {
    expect(resolveUserIdentity({ authEmail: 'A@B.com' })).toMatchObject({ email: 'a@b.com', email_source: 'account' });
    expect(resolveUserIdentity({ profileEmail: 'p@q.com' })).toMatchObject({ email: 'p@q.com', email_source: 'profile' });
  });
});

describe('source guard', () => {
  it('/api/admin/users/list resolves identity through the helper and the page renders the source', () => {
    const route = fs.readFileSync(path.join(process.cwd(), 'app/api/admin/users/list/route.ts'), 'utf8');
    expect(route).toMatch(/resolveUserIdentity\(/);
    const ui = fs.readFileSync(path.join(process.cwd(), 'components/admin/users/users-plans-manager.tsx'), 'utf8');
    expect(ui).toMatch(/name_source/);
  });
});
