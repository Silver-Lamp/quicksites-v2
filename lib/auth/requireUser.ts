// lib/auth/requireUser.ts
//
// Shared auth gates for mutating API routes. An anonymous Supabase user is a REAL
// authenticated user (getUser() returns them, `authenticated` role), and the
// middleware only redirects PAGE routes — so /api handlers must gate themselves.
//
// Usage:
//   const gate = await requireAdmin();
//   if (gate instanceof NextResponse) return gate;
//   const { user } = gate;   // the acting admin
import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { getServerSupabase } from '@/lib/supabase/server';
import { getAdminUser } from './getAdminUser';

/** Platform-admin gate → { user } or a 403 response. */
export async function requireAdmin(): Promise<{ user: User } | NextResponse> {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  return { user: admin };
}

/**
 * Signed-in-user gate → { user } or a 401 response. Rejects anonymous (guest)
 * sessions unless allowAnonymous is set (e.g. guest-build draft endpoints).
 */
export async function requireUser(opts?: { allowAnonymous?: boolean }): Promise<{ user: User } | NextResponse> {
  const supa = await getServerSupabase();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (user.is_anonymous && !opts?.allowAnonymous) {
    return NextResponse.json({ error: 'sign up to continue', code: 'needs_signup' }, { status: 401 });
  }
  return { user };
}
