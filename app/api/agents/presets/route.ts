// app/api/agents/presets/route.ts
// CRUD for presets in Supabase (table: agent_block_presets)
// ===============================
import { NextRequest as NextRequestPresets } from 'next/server';

export const dynamicPresets = 'force-dynamic';

async function getSupabase() {
  try {
    const { createServerClient } = await import('@supabase/ssr');
    const { cookies } = await import('next/headers');
    const cookieStore: any = cookies();
    return createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get: (key: string) => cookieStore.get(key)?.value,
          set: (key: string, value: string, options: any) => cookieStore.set(key, value, options),
          remove: (key: string, options: any) => cookieStore.set(key, '', { ...options, maxAge: 0 }),
        },
      }
    );
  } catch {
    return null;
  }
}

function normalizePresetRow(r: any) {
  return { id: r.id, title: r.title, name: r.name, group: r.grp, fields: r.fields, created_at: r.created_at };
}

export async function GET(req: NextRequestPresets) {
  try {
    const id = new URL(req.url).searchParams.get('id');
    const sb = await getSupabase();
    if (!sb) return new Response(JSON.stringify({ items: [] }), { status: 200 });

    if (id) {
      const { data, error } = await sb.from('agent_block_presets').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return new Response(JSON.stringify({ item: data ? normalizePresetRow(data) : null }), { status: 200 });
    }

    const { data, error } = await sb.from('agent_block_presets').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return new Response(JSON.stringify({ items: (data || []).map(normalizePresetRow) }), { status: 200 });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500 });
  }
}

export async function POST(req: NextRequestPresets) {
  try {
    const body = await req.json();
    const sb = await getSupabase();
    if (!sb) return new Response(JSON.stringify({ error: 'supabase not configured' }), { status: 200 });

    const row = { title: body.title, name: body.name, grp: body.group, fields: body.fields };
    const { data, error } = await sb.from('agent_block_presets').insert(row).select('*').single();
    if (error) throw error;
    return new Response(JSON.stringify({ item: normalizePresetRow(data) }), { status: 200 });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500 });
  }
}

export async function DELETE(req: NextRequestPresets) {
  try {
    const id = new URL(req.url).searchParams.get('id');
    if (!id) return new Response(JSON.stringify({ error: 'missing id' }), { status: 400 });
    const sb = await getSupabase();
    if (!sb) return new Response(JSON.stringify({ ok: true }), { status: 200 });

    const { error } = await sb.from('agent_block_presets').delete().eq('id', id);
    if (error) throw error;
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500 });
  }
}
