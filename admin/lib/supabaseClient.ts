// admin/lib/supabaseClient.ts
import { createBrowserClient } from '@supabase/ssr';

// NOTE: intentionally UNTYPED (no <Database> generic). This admin browser client is
// used across ~30 admin pages/components that query tables not present in the
// generated types (stale/legacy tables → `.insert()` resolves to `never`). Those
// call sites previously relied on fragile per-line `@ts-ignore`s that broke the
// Vercel build after the types regen. Detyping here removes the whole class at the
// source. Server/money-path clients (getServerSupabase, supabaseAdmin) stay strictly
// typed<Database>. TODO: re-type once the stale-table queries are reconciled.
//
// ⚠️ COOKIE-AWARE, NOT A BARE createClient (2026-10-20). The app signs users in through
// @supabase/ssr cookies; a plain `createClient` here never saw that session, so every one of
// those ~30 call sites ran as `anon` — invisible while their tables had no RLS, and a blank
// page for an admin the moment they did (docs/SECURITY_ADVISOR_2026-10.md, PR 3). Same shape
// as lib/supabase/client.ts, minus the Database generic for the reason above.
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
