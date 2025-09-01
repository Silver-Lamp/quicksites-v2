export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server/supabaseAdmin';
import { deepMergeDefined, applyTombstones, patchPaths, sha256 } from '@/lib/server/templateUtils';
import { logTemplateEvent } from '@/lib/server/logTemplateEvent';

// Optional: import your Zod schema if available
// import { TemplateDataSchema } from '@/admin/lib/zod/TemplateDataSchema';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { id, baseRev, patch, kind } = body as {
    id: string;
    baseRev: number;
    patch: any & { __delete__?: string[] };
    kind?: 'save' | 'autosave';
  };

  if (!id || typeof baseRev !== 'number' || typeof patch !== 'object') {
    return NextResponse.json({ error: 'id, baseRev, patch required' }, { status: 400 });
  }

  // Load current
  const { data: t, error: tErr } = await supabaseAdmin
    .from('templates')
    .select('id, data, rev')
    .eq('id', id)
    .single();

  if (tErr || !t) return NextResponse.json({ error: tErr?.message ?? 'Template not found' }, { status: 404 });

  if (t.rev !== baseRev) {
    return NextResponse.json({ error: 'merge_conflict', currentRev: t.rev }, { status: 409 });
  }

  // Apply tombstones then deep-merge
  const base = structuredClone(t.data ?? {});
  applyTombstones(base, patch.__delete__ ?? []);
  const merged = deepMergeDefined(base, patch);

  // Optional validation
  // const parsed = TemplateDataSchema.safeParse(merged);
  // if (!parsed.success) return NextResponse.json({ error: 'validation_failed', issues: parsed.error.format() }, { status: 422 });

  const { data: updated, error: upErr } = await supabaseAdmin
    .from('templates')
    .update({ data: merged, rev: t.rev + 1 })
    .eq('id', id)
    .select('id, data, rev')
    .single();

  if (upErr || !updated) {
    return NextResponse.json({ error: upErr?.message ?? 'Update failed' }, { status: 500 });
  }

  const hash = sha256(updated.data);

  await logTemplateEvent({
    template_id: id,
    type: kind === 'autosave' ? 'autosave' : 'save',
    rev_before: t.rev,
    rev_after: updated.rev,
    fields_touched: patchPaths(patch),
    diff: null,
  });

  return NextResponse.json({ id, rev: updated.rev, hash });
}
