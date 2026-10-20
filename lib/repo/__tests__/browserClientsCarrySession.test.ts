/**
 * @jest-environment node
 */
// lib/repo/__tests__/browserClientsCarrySession.test.ts — a browser-side Supabase client must be
// the cookie-aware one, or every query it makes runs as `anon`. admin/lib/supabaseClient.ts was a
// bare createClient for a year; ~30 admin components ran as anon and nobody saw it because their
// tables had no RLS (docs/SECURITY_ADVISOR_2026-10.md, PR 3). Source guards, since the defect is
// an import, not a return value.
import fs from 'node:fs';
import path from 'node:path';
import { stripComments } from '@/test/stripComments';

const read = (p: string) => stripComments(fs.readFileSync(path.join(process.cwd(), p), 'utf8'));

describe('browser clients carry the session', () => {
  it('admin/lib/supabaseClient.ts is the cookie-aware @supabase/ssr browser client', () => {
    const src = read('admin/lib/supabaseClient.ts');
    expect(src).toMatch(/createBrowserClient\(/);
    expect(src).not.toMatch(/\bcreateClient\(/);
  });
  it('the shared-preview creator inserts its snapshot as the signed-in owner, not with a bare anon client', () => {
    const src = read('admin/lib/createSharedPreview.ts');
    expect(src).toMatch(/from '@\/lib\/supabase\/client'/);
    expect(src).not.toMatch(/createClient\(/);
  });
});

describe('server routes that write owner-scoped tables use the service role', () => {
  it('the OG image route (reads/writes published_sites) does not use the anon key', () => {
    const src = read('app/api/og/[slug]/image/route.ts');
    expect(src).not.toMatch(/NEXT_PUBLIC_SUPABASE_ANON_KEY/);
    expect(src).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
  });
  it('the admin campaign-data route is admin-gated and reads with the service role', () => {
    const src = read('app/api/admin/campaign-data/route.ts');
    expect(src).toMatch(/requireAdmin\(\)/);
    expect(src).toMatch(/from '@\/lib\/supabase\/admin'/);
    expect(src).not.toMatch(/runtime = 'edge'/);
  });
});
