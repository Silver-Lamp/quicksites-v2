// app/api/templates/[id]/services/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';

const normalizeServices = (v: unknown): string[] => {
  if (!Array.isArray(v)) return [];
  return Array.from(new Set(v.map((s) => String(s ?? '').trim()).filter(Boolean)));
};

export async function PUT(
  req: NextRequest,
  context: { params: { id: string } } // ← not a Promise in route handlers
) {
  try {
    const { id } = context.params;
    const body = await req.json().catch(() => ({}));
    const cleaned = normalizeServices(body?.services ?? body);

    const supabase = await getServerSupabase();

    // Load current draft (RLS applies)
    const { data: row, error: loadErr } = await supabase
      .from('templates')
      .select('id, data, rev')
      .eq('id', id)
      .maybeSingle();

    if (loadErr || !row) {
      return NextResponse.json(
        { error: loadErr?.message || 'Template not found' },
        { status: 404 }
      );
    }

    const nextData = { ...(row.data ?? {}), services: cleaned };
    const nextRev = (row.rev ?? 0) + 1;

    const { error: updErr } = await supabase
      .from('templates')
      .update({ data: nextData, rev: nextRev })
      .eq('id', id);

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 400 });
    }

    return NextResponse.json({ services: cleaned });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 });
  }
}

//  * Optional: if you want to support GET for debugging:
export async function GET(req: NextRequest, { params: { id } }: { params: { id: string } }) {
   const supabase = await getServerSupabase();
   const { data, error } = await supabase
     .from('templates')
     .select('data->services')
     .eq('id', id)
     .maybeSingle();
   if (error) return NextResponse.json({ error: error.message }, { status: 400 });
   return NextResponse.json({ services: (data as any)?.services ?? [] });
}
