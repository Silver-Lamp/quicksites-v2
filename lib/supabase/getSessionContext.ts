'use server';

import { getRequestContext } from '@/lib/request/getRequestContext';
import { cookies } from 'next/headers';

export type { RequestContext as SessionContext } from '@/lib/request/getRequestContext';

/**
 * Backward-compatible alias for getRequestContext(true).
 * Returns full user session context including Supabase client and IP/userAgent headers.
 */
export async function getSessionContext() {
  return await getRequestContext({
    cookieStore: cookies(), // ✅ now sync
    headerStore: new Headers(),
  } as any); // withSupabase = true
}
