// app/api/org/create-demo/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server/supabaseAdmin';
import { requireUser } from '@/lib/auth/requireUser';

export async function POST(req: Request) {
  try {
    // Require a signed-in (non-anon) user; the new org is owned by THEM — never a
    // client-supplied owner_id (which was spoofable).
    const gate = await requireUser();
    if (gate instanceof NextResponse) return gate;

    const body = await req.json().catch(() => ({}));
    const name = body?.name || 'Demo Org';
    const owner_id = gate.user.id;

    const { data: org, error } = await supabaseAdmin
      .from('orgs')
      .insert([{ name }])
      .select('id')
      .single();
    if (error) throw error;

    await supabaseAdmin.from('org_members').insert([{ org_id: org.id, user_id: owner_id, role: 'owner' }]);

    return NextResponse.json({ org_id: org.id });
  } catch (e: any) {
    return new NextResponse(e?.message || 'Server error', { status: 500 });
  }
}
