// lib/auth/requireTemplateOwner.ts
//
// Route-level authorization for template mutations. Most app queries use the
// service-role key and bypass RLS, so the gate MUST live in the route — see
// CLAUDE.md §6 and docs/ARCHITECTURE.md §2 ("authorization is load-bearing").
//
// This factors out the owner-or-admin pattern already inlined in
// app/api/templates/[id]/publish/route.ts so unprotected routes can adopt it
// consistently. Allows: a user listed in `admin_users`, OR the template's
// `owner_id`. Anonymous (guest) builders are permitted when they own the row —
// matching the build flow (only *publishing* requires sign-up).

import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export type TemplateOwnerGate =
  | { ok: true; userId: string; isAdmin: boolean }
  | { ok: false; response: NextResponse };

/**
 * Require that the caller is authenticated AND is either a platform admin or the
 * owner of `templateId`. Returns the resolved identity on success, or a ready-to
 * -return error response (401 / 403 / 404) on failure.
 *
 *   const gate = await requireTemplateOwner(id);
 *   if (!gate.ok) return gate.response;
 *   // ...gate.userId / gate.isAdmin available here
 */
export async function requireTemplateOwner(templateId: string): Promise<TemplateOwnerGate> {
  const supa = await getServerSupabase();
  const {
    data: { user },
    error: userErr,
  } = await supa.auth.getUser();

  if (userErr || !user) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  // Platform admins may act on any template.
  const { data: adminRow } = await supabaseAdmin
    .from('admin_users')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (adminRow) return { ok: true, userId: user.id, isAdmin: true };

  // Otherwise, the caller must own the template.
  const { data: tpl } = await supabaseAdmin
    .from('templates')
    .select('owner_id')
    .eq('id', templateId)
    .maybeSingle();

  if (!tpl) {
    return { ok: false, response: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }
  if ((tpl as any).owner_id !== user.id) {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { ok: true, userId: user.id, isAdmin: false };
}
