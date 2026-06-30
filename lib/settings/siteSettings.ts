// lib/settings/siteSettings.ts
//
// Global key/value app settings (public.site_settings). Server-only: uses the
// service-role key (RLS denies anon/auth). Values are stored as jsonb.

import { createClient } from '@supabase/supabase-js';

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
    { auth: { persistSession: false } }
  );
}

/** Read a global setting, returning `fallback` if missing or on any error. */
export async function getSiteSetting<T = unknown>(key: string, fallback: T): Promise<T> {
  try {
    const { data, error } = await admin()
      .from('site_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle();
    if (error) return fallback;
    return (data?.value ?? fallback) as T;
  } catch {
    return fallback;
  }
}

/** Upsert a global setting. Throws on write failure (callers should be admin-gated). */
export async function setSiteSetting(key: string, value: unknown, updatedBy?: string | null): Promise<void> {
  const { error } = await admin()
    .from('site_settings')
    .upsert(
      { key, value, updated_at: new Date().toISOString(), updated_by: updatedBy ?? null },
      { onConflict: 'key' }
    );
  if (error) throw error;
}
