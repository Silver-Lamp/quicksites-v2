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
import { supabaseAdmin } from '@/lib/supabase/admin';
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

/** Platform admin bypass. */
async function isPlatformAdmin(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin.from('admin_users').select('user_id').eq('user_id', userId).maybeSingle();
  return !!data;
}

/**
 * Require the caller to own `merchantId` (merchants.owner_id or user_id) or be a
 * platform admin → { user } or 401/403/404. Most merchant routes take a merchantId
 * in the body and write via the service role (RLS bypass), so this is the gate.
 */
export async function requireMerchantOwner(merchantId: string): Promise<{ user: User } | NextResponse> {
  const gate = await requireUser();
  if (gate instanceof NextResponse) return gate;
  if (await isPlatformAdmin(gate.user.id)) return gate;

  const { data: m } = await supabaseAdmin.from('merchants').select('owner_id, user_id').eq('id', merchantId).maybeSingle();
  if (!m) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if ((m as any).owner_id !== gate.user.id && (m as any).user_id !== gate.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return gate;
}

/**
 * Require the caller to be an admin of `orgId` (app.is_org_admin) or a platform
 * admin → { user } or 401/403.
 */
export async function requireOrgAdmin(orgId: string): Promise<{ user: User } | NextResponse> {
  const gate = await requireUser();
  if (gate instanceof NextResponse) return gate;

  const [admin, { data: isOrgAdmin }] = await Promise.all([
    isPlatformAdmin(gate.user.id),
    (supabaseAdmin as any).schema('app').rpc('is_org_admin', { p_org: orgId, p_user: gate.user.id }),
  ]);
  if (!admin && !isOrgAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  return gate;
}
