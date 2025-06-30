// lib/cookies/getRequestIds.ts
'use server';

import { v4 as uuidv4 } from 'uuid';
import { getCookieStore } from '../safeCookies';
import { cookies } from 'next/headers';

/**
 * Returns or sets request-scoped IDs for tracing and segmentation.
 */
export async function getRequestIds(): Promise<{
  sessionId: string;
  traceId: string;
  abVariant?: string;
}> {
  const store = await getCookieStore(); // ✅ uses wrapped cookie getter
  let sessionId = store.get('session-id')?.value;
  let abVariant = store.get('ab-variant')?.value;
  const traceId = uuidv4();

  if (!sessionId) {
    sessionId = uuidv4();
    const cookieJar = await cookies(); // ✅ get write access
    cookieJar.set('session-id', sessionId, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
  }

  return { sessionId, traceId, abVariant };
}
