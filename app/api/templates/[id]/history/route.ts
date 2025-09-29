// app/api/templates/[id]/history/route.ts
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server/supabaseAdmin';

/** Map DB row -> TemplateEvent the Timeline expects */
function toEvent(rows: any[]) {
  return rows.map((v, idx, arr) => {
    const counts = v?.diff?.counts ?? {};
    const created = v?.created_at ?? v?.saved_at ?? new Date().toISOString();
    return {
      id: v.id,
      type: (v.kind ?? 'version') as string,
      at: new Date(created).toISOString(),
      revAfter: arr.length - idx,                 // 1-based, newest first
      revBefore: arr.length - idx - 1 || null,
      diff: {
        added: Number(counts.added ?? 0),
        changed: Number(counts.changed ?? 0),
        removed: Number(counts.removed ?? 0),
      },
      meta: {
        snapshot: { id: v.id, data: v.full_data ?? null },
        hash: v.hash ?? null,
        editor_id: v.editor_id ?? null,
        commit_message: v.commit_message ?? null,
        raw_diff: v.diff ?? null,
        thumbnail_url: v.thumbnail_url ?? null,
      },
    };
  });
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }   // 👈 params is a Promise in Next 15
) {
  try {
    const { id } = await ctx.params;         // 👈 await it
    const { data, error } = await supabaseAdmin
      .from('template_versions')             // public schema
      .select('*')
      .eq('template_id', id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[history] select error', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ templateId: id, items: toEvent(data ?? []) });
  } catch (e: any) {
    console.error('[history] GET failed', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
