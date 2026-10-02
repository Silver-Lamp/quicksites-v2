// app/api/admin/demo-narration/route.ts
//
// Owner-recorded narration takes for the demo clips.
//
// ⚠️ ADMIN-ONLY, AND THE AUDIO BUCKET IS PRIVATE. These are unreleased voice recordings of a
// named person; a take is reachable only through a short-lived signed URL minted here. Nothing
// is ever served from a public storage path — the mistake the résumé library documents at
// length (a public bucket makes the FILENAME the disclosure and cannot be walked back).
//
// ⚠️ Takes are keyed by `<clip>@<recordedOn>`, not by clip name. Re-recording a demo shifts
// every cue, so narration timed against the old cut must NOT be found for the new one.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/requireUser';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { parseClipKey } from '@/lib/demos/narration';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BUCKET = 'demo-narration';
const SIGN_SECONDS = 60 * 60;
/** A spoken line. Comfortably past a long sentence, far short of a recording left running. */
const MAX_TAKE_BYTES = 8 * 1024 * 1024;

type TakeRow = {
  line_index: number;
  storage_path: string;
  duration_ms: number;
  said: string | null;
  updated_at: string;
};

/** GET ?clipKey=finished-site@2026-10-01 → the takes we hold, with signed playback URLs. */
export async function GET(req: Request) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  const clipKey = new URL(req.url).searchParams.get('clipKey') ?? '';
  if (!parseClipKey(clipKey)) {
    return NextResponse.json({ error: 'clipKey must be <clip>@<recordedOn>' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('demo_narration_takes')
    .select('line_index, storage_path, duration_ms, said, updated_at')
    .eq('clip_key', clipKey)
    .order('line_index');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as TakeRow[];
  const takes = await Promise.all(
    rows.map(async (r) => {
      const { data: signed } = await supabaseAdmin.storage
        .from(BUCKET)
        .createSignedUrl(r.storage_path, SIGN_SECONDS);
      return {
        lineIndex: r.line_index,
        url: signed?.signedUrl ?? '',
        durationMs: r.duration_ms,
        said: r.said,
        updatedAt: r.updated_at,
      };
    }),
  );
  // A take whose signed URL could not be minted is reported as missing rather than as a take
  // with an empty src, which would render a player that silently does nothing.
  return NextResponse.json({ ok: true, takes: takes.filter((t) => t.url) });
}

const PostMeta = z.object({
  clipKey: z.string().min(3),
  lineIndex: z.coerce.number().int().min(0).max(200),
  durationMs: z.coerce.number().int().positive().max(10 * 60 * 1000),
  said: z.string().max(2000).optional(),
});

/** POST multipart: one take for one line. Replaces whatever was there. */
export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'expected multipart/form-data' }, { status: 400 });

  const parsed = PostMeta.safeParse({
    clipKey: form.get('clipKey'),
    lineIndex: form.get('lineIndex'),
    durationMs: form.get('durationMs'),
    said: form.get('said') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid body', issues: parsed.error.issues }, { status: 400 });
  }
  const { clipKey, lineIndex, durationMs, said } = parsed.data;
  if (!parseClipKey(clipKey)) {
    return NextResponse.json({ error: 'clipKey must be <clip>@<recordedOn>' }, { status: 400 });
  }

  const audio = form.get('audio');
  if (!(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json({ error: 'audio is required' }, { status: 400 });
  }
  if (audio.size > MAX_TAKE_BYTES) {
    return NextResponse.json({ error: 'take is too large for one line' }, { status: 413 });
  }

  // ⚠️ The path is SERVER-DERIVED from the validated key, never from anything the client names.
  // A client-supplied path is a write-anywhere primitive against the whole bucket.
  const safeKey = clipKey.replace(/[^a-zA-Z0-9@._-]/g, '_');
  const storagePath = `${safeKey}/line-${String(lineIndex).padStart(3, '0')}.webm`;

  const { error: upErr } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(storagePath, Buffer.from(await audio.arrayBuffer()), {
      contentType: audio.type || 'audio/webm',
      upsert: true,
    });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  const { error: dbErr } = await supabaseAdmin.from('demo_narration_takes').upsert(
    {
      clip_key: clipKey,
      line_index: lineIndex,
      storage_path: storagePath,
      duration_ms: durationMs,
      said: said ?? null,
      created_by: gate.user?.id ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'clip_key,line_index' },
  );
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

  const { data: signed } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGN_SECONDS);
  return NextResponse.json({ ok: true, lineIndex, url: signed?.signedUrl ?? '', durationMs });
}

/** DELETE ?clipKey=…&lineIndex=2 — drop a take so the line goes back to silent. */
export async function DELETE(req: Request) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  const url = new URL(req.url);
  const clipKey = url.searchParams.get('clipKey') ?? '';
  const lineIndex = Number(url.searchParams.get('lineIndex'));
  if (!parseClipKey(clipKey) || !Number.isInteger(lineIndex) || lineIndex < 0) {
    return NextResponse.json({ error: 'clipKey and lineIndex are required' }, { status: 400 });
  }

  const { data: row } = await supabaseAdmin
    .from('demo_narration_takes')
    .select('storage_path')
    .eq('clip_key', clipKey)
    .eq('line_index', lineIndex)
    .maybeSingle();

  // Remove the row first: an orphaned object costs a few KB, while a row pointing at a deleted
  // object renders a take that plays nothing.
  const { error } = await supabaseAdmin
    .from('demo_narration_takes')
    .delete()
    .eq('clip_key', clipKey)
    .eq('line_index', lineIndex);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const path = (row as { storage_path: string } | null)?.storage_path;
  if (path) await supabaseAdmin.storage.from(BUCKET).remove([path]).catch(() => {});

  return NextResponse.json({ ok: true });
}
