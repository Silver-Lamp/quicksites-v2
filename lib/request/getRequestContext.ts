// lib/request/getRequestContext.ts
'use server';

import crypto from 'crypto';
import { getSafeCookie } from '../safeCookies';
import { getReadableCookieStore } from '../utils/getReadableCookieStore';
import { getHeaderStore, getClientIp, getUserAgent, getReferer } from '../safeHeaders';
import { getOrCreateSessionCookie } from '../cookies/getOrCreateSessionCookie';
import { getMockLocation } from './getMockLocation';

import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@/types/supabase';
import type { SupabaseCookieAdapter } from '@/types/supabase';
import type { MockGeoLocation } from '@/types/location';

export type RequestContext = {
  cookies: Awaited<ReturnType<typeof getReadableCookieStore>>;
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
  geo: MockGeoLocation | null;
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

  const [cookies, headers] = await Promise.all([
    getReadableCookieStore(),
    getHeaderStore(),
  ]);

  const [ip, userAgent, referer, abVariant, sessionId, geo] = await Promise.all([
    getClientIp(),
    getUserAgent(),
    getReferer(),
    getSafeCookie('ab-variant', cookies) as Promise<string | undefined>,
    getOrCreateSessionCookie(),
    getMockLocation(),
  ]);

  const role = headers.get('x-user-role') ?? undefined;
  const userId = headers.get('x-user-id') ?? undefined;
  const userEmail = headers.get('x-user-email') ?? undefined;

  const traceId = crypto.randomUUID();

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
    geo,
  };

  if (withSupabase) {
    const supabase = createServerComponentClient<Database>({
      cookies: getReadableCookieStore, // ✅ use consistent read-only adapter
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
