'use server';

import crypto from 'crypto';
import { safeParse } from '../utils/safeParse';
import { getClientIp, getUserAgent, getReferer } from '../safeHeaders';
import { getOrCreateSessionCookie } from '../cookies/getOrCreateSessionCookie';
import { getMockLocation } from './getMockLocation';

import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import type { MockGeoLocation } from '@/types/location';
import type { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies';
import type { ReadonlyHeaders } from 'next/dist/server/web/spec-extension/adapters/headers';

import { getSupabaseCookieAdapter } from '../utils/getSupabaseCookieAdapter';

export type RequestContext = {
  // read-only stores for the current request
  cookies: ReadonlyRequestCookies;
  headers: ReadonlyHeaders;
  cookieMode: 'readonly';
  headerMode: 'readonly';

  // request/user bits we surface everywhere
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

  // optional Supabase client + current auth user
  supabase?: {
    client: SupabaseClient<Database>;
    user: {
      id: string;
      email: string;
      role?: string;
    } | null;
  };
};

export async function getRequestContext(
  stores: {
    cookieStore: ReadonlyRequestCookies;
    headerStore: ReadonlyHeaders;
    abRaw?: string | null;
    role?: string;
    userId?: string;
    userEmail?: string;
  },
  withSupabase = false
): Promise<RequestContext> {
  if (!stores?.cookieStore || !stores?.headerStore) {
    throw new Error(
      'getRequestContext: Missing cookieStore or headerStore. ' +
      'Make sure you pass the values returned from next/headers() helpers.'
    );
  }

  const { cookieStore, headerStore, abRaw, role, userId, userEmail } = stores;

  // safe, permissive parse for A/B flag (accepts raw string too)
  const abVariant = (safeParse(abRaw) as string | undefined) ?? (abRaw ?? undefined);

  // pull common request metadata (these helpers should already await cookies()/headers() internally)
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
    // IMPORTANT: the adapter must follow CookieMethodsServer (getAll / setAll).
    const cookieAdapter = getSupabaseCookieAdapter(cookieStore);

    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: cookieAdapter as any,
        cookieEncoding: 'base64url', // <- required with modern helpers
      }
    );

    const { data: { user } } = await supabase.auth.getUser();

    context.supabase = {
      client: supabase as any,
      user: user
        ? {
            id: user.id,
            email: user.email ?? '',
            // allow either app_metadata.role or user_metadata.role
            role: (user.app_metadata as any)?.role ?? (user.user_metadata as any)?.role,
          }
        : null,
    };
  }

  return context;
}
