import { getCookieBoundClient } from './clients';

export async function assertAdmin() {
  const supa = await getCookieBoundClient();
  const { data: auth } = await supa.auth.getUser();
  if (!auth?.user) return { ok: false as const, status: 401, error: 'Not signed in' };

  const { data: admin } = await supa
    .from('admin_users')
    .select('user_id')
    .eq('user_id', auth.user.id)
    .limit(1);

  if (!admin?.[0]) return { ok: false as const, status: 403, error: 'Forbidden' };
  return { ok: true as const, supa, adminUserId: auth.user.id };
}
