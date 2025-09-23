// app/api/org/list/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server/supabaseAdmin';

/**
 * Returns orgs the current user can reasonably pick.
 * Adjust table names/filters to your schema:
 *  - orgs(id, name)
 *  - org_members(org_id, user_id)
 *  - profiles.default_org_id (optional)
 */
export async function GET() {
  try {
    // If you can read the current user from cookies, do it here.
    // For a simple MVP, return a short list of orgs (or all, if private).
    const { data, error } = await supabaseAdmin
      .from('orgs')
      .select('id,name')
      .limit(50);
    if (error) throw error;
    return NextResponse.json({ orgs: data ?? [] });
  } catch (e: any) {
    return new NextResponse(e?.message || 'Server error', { status: 500 });
  }
}
