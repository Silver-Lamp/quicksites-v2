// app/api/templates/[id]/services/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';

const normalizeServices = (v: unknown): string[] => {
  if (!Array.isArray(v)) return [];
  const dedup = new Set(
    v.map((s) => String(s ?? '').trim()).filter(Boolean)
  );
  return Array.from(dedup);
};

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }  // 👈 Promise
) {
  const { id } = await context.params;          // ✅ await
  const body = await req.json().catch(() => ({}));
  const cleaned = normalizeServices(body?.services ?? body);

  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from('templates')
    .update({ services_jsonb: cleaned })         // ✅ write JSONB column
    .eq('id', id)
    .select('services_jsonb')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ services: data.services_jsonb });
}
