// lib/auth/getAdminUser.ts
// Returns the logged-in user if they're a platform admin, else null.
// Admin is resolved from (in order): the ADMIN_EMAILS env allowlist, a role=admin/
// superadmin JWT claim, OR membership in the authoritative `admin_users` table — the
// same source the client nav (useIsAdmin) and public.is_platform_admin() trust. Without
// the admin_users check, an admin who is ONLY in that table (not in ADMIN_EMAILS / no
// JWT role) was wrongly rejected by every getAdminUser-gated page (e.g. /admin/cron).
import { getServerSupabase } from '@/lib/supabase/server';

const ADMIN_EMAILS = String(process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export async function getAdminUser() {
  const supa = await getServerSupabase();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) return null;

  const email = (user.email || '').toLowerCase();
  const role = String(
    (user.app_metadata as any)?.role || (user.user_metadata as any)?.role || ''
  ).toLowerCase();
  if (ADMIN_EMAILS.includes(email) || role === 'admin' || role === 'superadmin') return user;

  // Authoritative fallback: the admin_users table (readable by the session; RLS SELECT
  // policy is `true`). This is the source of truth the rest of the app agrees on.
  try {
    const { data } = await supa
      .from('admin_users')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (data) return user;
  } catch {
    /* fall through to non-admin */
  }
  return null;
}
