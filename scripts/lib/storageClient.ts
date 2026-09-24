// scripts/lib/storageClient.ts
//
// The Supabase client the nightly sitemap scripts use to WRITE to Storage.
//
// ⚠️ THEY USED TO IMPORT `admin/lib/supabaseClient`, WHICH IS A BROWSER CLIENT. Its own header says
// so ("This admin browser client is used across ~30 admin pages/components"), and it is built from
// `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Two consequences, and the second is why the jobs looked
// unfixable:
//
//   1. Writing to Storage as `anon` depends on whichever storage policy happens to match, which is
//      a bet rather than a design. A server-side job should not be subject to RLS it cannot see.
//   2. The workflow was carefully exporting `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` — and
//      writing them into a `.env` file — for scripts that read NEITHER. It fed variables nothing
//      consumed, so the obvious fix ("add the missing secrets") could never have worked. That is
//      the same shape as the `SUPABASE_URL` vs `NEXT_PUBLIC_SUPABASE_URL` mismatch in the analytics
//      job: a name nobody reads looks exactly like a name nobody set.
//
// ⚠️ THE `ws` POLYFILL MUST BE INSTALLED BEFORE THE CLIENT IS CONSTRUCTED. On Node 20 the Supabase
// client throws "Node.js 20 detected without native WebSocket support" at construction time, and in
// a queue context that surfaces as a fallback rather than an error (CLAUDE.md, render workers).
// The import order in this file is load-bearing; do not let a formatter sort it.

// @ts-expect-error - `ws` ships no bundled types; runtime-only polyfill for Node 20
import ws from 'ws';
(globalThis as any).WebSocket ??= ws;

import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
// Accepts either name: this project migrated to the new Supabase API keys, so `.env.local` carries
// SUPABASE_SECRET_KEY while older callers and CI still say SUPABASE_SERVICE_ROLE_KEY.
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';

if (!url || !key) {
  // ⚠️ Fail with the NAMES, not "supabaseUrl is required". That bare message is what these jobs
  // printed every night for seven months, and it says nothing about which of four plausible
  // variables is missing — which is precisely why the fix was mis-diagnosed as "add the secrets".
  throw new Error(
    'Supabase credentials missing for a storage script.\n' +
      `  NEXT_PUBLIC_SUPABASE_URL: ${url ? 'set' : 'MISSING'}\n` +
      `  SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY: ${key ? 'set' : 'MISSING'}\n` +
      'In CI these come from repository secrets; locally from .env.local.'
  );
}

/** Service-role client: bypasses RLS, which is correct for an unattended server-side upload. */
export const supabase = createClient(url, key, { auth: { persistSession: false } });
