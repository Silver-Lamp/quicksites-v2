'use server';

import crypto from 'crypto';
import { safeParse } from '../utils/safeParse';
import { getClientIp, getUserAgent, getReferer } from '../safeHeaders';
import { getOrCreateSessionCookie } from '../cookies/getOrCreateSessionCookie';
import { getMockLocation } from './getMockLocation';
import { getSupabaseCookieAdapter } from '../utils/getSupabaseCookieAdapter';

import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import type { MockGeoLocation } from '@/types/location';
import type { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies';
import type { ReadonlyHeaders } from 'next/dist/server/web/spec-extension/adapters/headers';

export type RequestContext = {
  cookies: ReadonlyRequestCookies;
  headers: ReadonlyHeaders;
  cookieMode: 'readonly';
  headerMode: 'readonly';

  ip: string;
  userAgent: string;
  referer?: string;
  role?: string;
  userId?: string;
  userEmail?: string;
  abVariant?: string;
  sessionId: string;
  traceId: string;
  geo: MockGeoLocation | null;

  supabase?: {
    client: SupabaseClient<Database>;
    user: {
      id: string;
      email: string;
      role?: string;
    } | null;
  };
};

let _requestContextCache: RequestContext | null = null;

export async function getRequestContext(
  stores?: {
    cookieStore: ReadonlyRequestCookies;
    headerStore: ReadonlyHeaders;
    abRaw?: string | null;
    role?: string;
    userId?: string;
    userEmail?: string;
  },
  withSupabase = false
): Promise<RequestContext> {
  if (_requestContextCache) return _requestContextCache;

  if (!stores?.cookieStore || !stores?.headerStore) {
    throw new Error(
      `getRequestContext: Missing cookieStore or headerStore. Did you forget to call extractUserContext()?`
    );
  }

  const {
    cookieStore,
    headerStore,
    abRaw,
    role,
    userId,
    userEmail,
  } = stores;

  const abVariant = safeParse(abRaw) as string | undefined;

  const [ip, userAgent, referer, sessionId, geo] = await Promise.all([
    getClientIp(),
    getUserAgent(),
    getReferer(),
    getOrCreateSessionCookie(),
    getMockLocation(),
  ]);

  const traceId = crypto.randomUUID();

  const context: RequestContext = {
    cookies: cookieStore,
    headers: headerStore,
    cookieMode: 'readonly',
    headerMode: 'readonly',
    ip,
    userAgent,
    referer,
    role,
    userId,
    userEmail,
    abVariant,
    sessionId,
    traceId,
    geo,
  };

  if (withSupabase) {
    const supabase = createServerComponentClient<Database>({
      cookies: getSupabaseCookieAdapter(cookieStore),
    });

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
