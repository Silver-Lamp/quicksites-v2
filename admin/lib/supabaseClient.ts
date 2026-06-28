// admin/lib/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

// NOTE: intentionally UNTYPED (no <Database> generic). This admin browser client is
// used across ~30 admin pages/components that query tables not present in the
// generated types (stale/legacy tables → `.insert()` resolves to `never`). Those
// call sites previously relied on fragile per-line `@ts-ignore`s that broke the
// Vercel build after the types regen. Detyping here removes the whole class at the
// source. Server/money-path clients (getServerSupabase, supabaseAdmin) stay strictly
// typed<Database>. TODO: re-type once the stale-table queries are reconciled.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
