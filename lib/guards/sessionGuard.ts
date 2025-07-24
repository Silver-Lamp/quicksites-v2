import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getRequestContext } from '../request/getRequestContext';

export async function sessionGuard(redirectTo = '/admin/dashboard') {
  const { userId } = await getRequestContext({
    cookieStore: cookies(), // ✅ no `await` needed
    headerStore: new Headers(),
  } as any);

  if (userId) {
    redirect(redirectTo);
  }
}
