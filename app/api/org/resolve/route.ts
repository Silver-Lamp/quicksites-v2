// app/api/org/resolve/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server/supabaseAdmin';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const template_id = searchParams.get('template_id') || '';

    // 1) Template -> org_id (if stored)
    if (template_id) {
      const { data: t, error: tErr } = await supabaseAdmin
        .from('templates')
        .select('org_id')
        .eq('id', template_id)
        .single();
      if (tErr) {} // ignore
      if (t?.org_id) return NextResponse.json({ org_id: t.org_id, source: 'template' });
    }

    // 2) Current user's default org (profiles.default_org_id)
    const { data: me } = await supabaseAdmin.auth.getUser(); // if you have service role, swap to server client w/ cookies
    const uid = me?.user?.id;
    if (uid) {
      const { data: prof } = await supabaseAdmin
        .from('profiles')
        .select('default_org_id')
        .eq('id', uid)
        .single();
      if (prof?.default_org_id) {
        return NextResponse.json({ org_id: prof.default_org_id, source: 'profile' });
      }

      // 3) First org membership
      const { data: mem } = await supabaseAdmin
        .from('org_members')
        .select('org_id')
        .eq('user_id', uid)
        .limit(1);
      if (mem?.[0]?.org_id) {
        return NextResponse.json({ org_id: mem[0].org_id, source: 'membership' });
      }
    }

    return new NextResponse(JSON.stringify({ message: 'No organization found' }), { status: 404 });
  } catch (e: any) {
    return new NextResponse(e?.message || 'Server error', { status: 500 });
  }
}
