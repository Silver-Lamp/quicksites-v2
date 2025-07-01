'use server';

import { getWritableCookieStore } from '@/lib/utils/getWritableCookieStore';

/**
 * Sets the session-id cookie. Safe only in Server Action or Route Handler.
 */
export async function setSessionCookie(sessionId: string) {
  const store = await getWritableCookieStore();

  store.set('session-id', sessionId, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}
