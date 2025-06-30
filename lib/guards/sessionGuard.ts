'use server';

import { getRequestContext } from '../request/getRequestContext';
import { redirect } from 'next/navigation';

/**
 * If user is logged in, redirect them to the desired page.
 * Use this on routes like /login or /signup.
 */
export async function sessionGuard(redirectTo = '/admin/dashboard') {
  const { userId } = await getRequestContext(true); // withSupabase = true

  if (userId) {
    redirect(redirectTo); // Server redirect
  }
}
