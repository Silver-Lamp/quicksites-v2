// lib/auth/getAdminUser.ts
// Returns the logged-in user if they're an admin (ADMIN_EMAILS or role=admin/superadmin),
// else null. Mirrors the inline check used across app/api/admin/*.
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
  const role = String((user.app_metadata as any)?.role || (user.user_metadata as any)?.role || '').toLowerCase();
  const isAdmin = ADMIN_EMAILS.includes(email) || role === 'admin' || role === 'superadmin';
  return isAdmin ? user : null;
}
