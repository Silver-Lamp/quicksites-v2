import { cookies as getCookies } from 'next/headers';
import { getCookieStore, getSafeCookie } from '../safeCookies';
import { getHeaderStore } from '../safeHeaders';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '../../types/supabase';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

export type RequestContext = {
  cookies: Awaited<ReturnType<typeof getCookies>>;
  headers: Awaited<ReturnType<typeof getHeaderStore>>;
  ip: string;
  userAgent: string;
  referer?: string;
  role?: string;
  userId?: string;
  userEmail?: string;
  abVariant?: string;
  sessionId: string;
  traceId: string;
  supabase?: {
    client: ReturnType<typeof createServerComponentClient<Database>>;
    user: {
      id: string;
      email: string;
      role?: string;
    } | null;
  };
};

let _requestContextCache: RequestContext | null = null;

export async function getRequestContext(withSupabase = false): Promise<RequestContext> {
  if (_requestContextCache) return _requestContextCache;

  const cookies = await getCookieStore();
  const headers = await getHeaderStore();
  const traceId = crypto.randomUUID();

  const ip =
    headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    headers.get('x-real-ip') ??
    'unknown';

  const userAgent = headers.get('user-agent') ?? 'unknown';
  const referer = headers.get('referer') ?? undefined;

  const role = headers.get('x-user-role') ?? undefined;
  const userId = headers.get('x-user-id') ?? undefined;
  const userEmail = headers.get('x-user-email') ?? undefined;

  const abVariant = (await getSafeCookie('ab-variant', cookies)) as string | undefined;

  let sessionId =
    (await getSafeCookie('session-id', cookies)) as string | undefined;

  if (!sessionId) {
    sessionId = uuidv4();
    // cookies.set('session-id', sessionId); // optional: persist for next requests
  }

  const context: RequestContext = {
    cookies,
    headers,
    ip,
    userAgent,
    referer,
    role,
    userId,
    userEmail,
    abVariant,
    sessionId,
    traceId,
  };

  // Optional Supabase block
  if (withSupabase) {
    const supabase = createServerComponentClient<Database>({ cookies: () => Promise.resolve(cookies) });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    context.supabase = {
      client: supabase,
      user: user
        ? {
            id: user.id,
            email: user.email ?? '',
            role: user.user_metadata?.role,
          }
        : null,
    };
  }

  _requestContextCache = context;
  return context;
}
