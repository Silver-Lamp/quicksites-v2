// app/api/templates/route.ts
import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server'; // your server client

export async function POST(req: Request) {
  const { template } = await req.json();
  const supabase = await getServerSupabase();

  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes?.user) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }
  const userId = userRes.user.id;

  // normalize insert
  const now = new Date().toISOString();
  const insertable = {
    ...template,
    owner_id: template?.owner_id || userId, // <-- important for RLS
    verified: false,                        // <-- avoid admin-only check
    created_at: template?.created_at || now,
    updated_at: now,
  };

  // Upsert by primary key (id). If your conflict target is different, adjust onConflict.
  const { data, error } = await supabase
    .from('templates')
    .upsert(insertable, { onConflict: 'id' })
    .select()
    .maybeSingle(); // tolerate 0 visible rows under RLS on returning

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  // If RLS hid the row, give the client back the payload so it can keep going.
  return NextResponse.json({ ok: true, template: data ?? insertable });
}
