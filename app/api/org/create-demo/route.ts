// app/api/org/create-demo/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server/supabaseAdmin';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const name = body?.name || 'Demo Org';
    const owner_id = body?.owner_id || null;

    const { data: org, error } = await supabaseAdmin
      .from('orgs')
      .insert([{ name }])
      .select('id')
      .single();
    if (error) throw error;

    if (owner_id) {
      await supabaseAdmin.from('org_members').insert([{ org_id: org.id, user_id: owner_id, role: 'owner' }]);
    }

    return NextResponse.json({ org_id: org.id });
  } catch (e: any) {
    return new NextResponse(e?.message || 'Server error', { status: 500 });
  }
}
