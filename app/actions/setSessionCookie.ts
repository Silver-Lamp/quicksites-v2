'use server';

import { cookies } from 'next/headers';

/**
 * Sets the session-id cookie. Safe only in Server Action or Route Handler.
 */
export async function setSessionCookie(sessionId: string) {
  const store = cookies();

  store.set('session-id', sessionId, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}
