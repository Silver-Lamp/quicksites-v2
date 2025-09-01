// app/api/templates/state/route.ts
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // server-only
const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

function sha256(obj: unknown) {
  return createHash('sha256').update(JSON.stringify(obj ?? {})).digest('hex');
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  // 1) Template
  const { data: t, error: tErr } = await supabase
    .from('templates')
    .select('id, data, rev, site_id')
    .eq('id', id)
    .single();

  if (tErr || !t) return NextResponse.json({ error: tErr?.message ?? 'Template not found' }, { status: 404 });

  const draftHash = sha256(t.data);

  // 2) Snapshots (newest-first)
  const { data: snaps } = await supabase
    .from('snapshots')
    .select('id, template_id, rev, data, hash, created_at')
    .eq('template_id', id)
    .order('created_at', { ascending: false });

  const snapshots = (snaps ?? []).map((s) => ({
    id: s.id,
    rev: s.rev,
    hash: s.hash || sha256(s.data),
    createdAt: s.created_at,
  }));

  const lastSnapshot = snapshots[0];

  // 3) Site (optional)
  // Prefer a direct template_id relation if you have one.
  let site: { id: string; slug: string; published_snapshot_id?: string } | undefined;
  try {
    const { data: siteRow } = await supabase
      .from('sites')
      .select('id, slug, published_snapshot_id, template_id')
      .eq('template_id', id)
      .maybeSingle();
    if (siteRow) {
      site = {
        id: siteRow.id,
        slug: siteRow.slug,
        published_snapshot_id: siteRow.published_snapshot_id ?? undefined,
      };
    }
  } catch (_) {
    // ignore if sites not present yet
  }

  // 4) Versions (optional)
  let versions: Array<{ tag: string; snapshotId: string; notes?: string; createdAt?: string }> = [];
  try {
    const { data: v } = await supabase
      .from('versions')
      .select('tag, snapshot_id, notes, created_at')
      .in(
        'snapshot_id',
        snapshots.map((s) => s.id)
      );
    if (v) {
      versions = v.map((r) => ({
        tag: r.tag,
        snapshotId: r.snapshot_id,
        notes: r.notes ?? undefined,
        createdAt: r.created_at,
      }));
    }
  } catch (_) {
    // table may not exist yet
  }

  // 5) Events (optional)
  let events: any[] = [];
  try {
    const { data: ev } = await supabase
      .from('template_events')
      .select('id, type, at, rev_before, rev_after, actor, fields_touched, diff')
      .eq('template_id', id)
      .order('at', { ascending: false })
      .limit(200);

    events = (ev ?? []).map((e) => ({
      id: e.id,
      type: e.type,
      at: e.at,
      revBefore: e.rev_before ?? undefined,
      revAfter: e.rev_after ?? undefined,
      actor: e.actor ?? undefined,
      fieldsTouched: e.fields_touched ?? undefined,
      diff: e.diff ?? undefined,
    }));
  } catch (_) {
    // table may not exist yet
  }

  // 6) Admin meta (deprecated files)
  let deprecated_files: string[] = [];
  try {
    const { data: meta } = await supabase
      .from('template_admin_meta')
      .select('deprecated_files')
      .eq('template_id', id)
      .maybeSingle();

    if (meta?.deprecated_files && Array.isArray(meta.deprecated_files)) {
      deprecated_files = meta.deprecated_files as string[];
    }
  } catch (_) {
    // table may not exist yet
  }

  const payload = {
    infra: {
      template: { id: t.id, rev: t.rev, hash: draftHash },
      site: site
        ? { id: site.id, slug: site.slug, publishedSnapshotId: site.published_snapshot_id }
        : undefined,
      lastSnapshot: lastSnapshot
        ? { id: lastSnapshot.id, rev: lastSnapshot.rev, hash: lastSnapshot.hash, createdAt: lastSnapshot.createdAt }
        : undefined,
      cache: null, // you can fill this from your cache layer later
    },
    snapshots,
    versions,
    events,
    adminMeta: {
      deprecated_files,
      count: deprecated_files.length,
    },
  };

  return NextResponse.json(payload);
}
