// app/api/templates/state/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

function sha256(obj: unknown) {
  return createHash('sha256').update(JSON.stringify(obj ?? {})).digest('hex');
}

// helpers to derive industry/services from a data object
function deriveIndustryFromData(data: any): string | undefined {
  try {
    const v = data?.meta?.industry ?? data?.industry ?? undefined;
    return typeof v === 'string' && v.trim() ? v.trim() : undefined;
  } catch {
    return undefined;
  }
}
function normalizeServicesList(v: any): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object') {
        const base = String(item.name ?? item.title ?? '').trim();
        const price =
          item.price != null && String(item.price).trim() !== ''
            ? ` — ${
                typeof item.price === 'number' ? `$${item.price.toFixed(2)}` : String(item.price)
              }`
            : '';
        return base ? `${base}${price}` : '';
      }
      return '';
    })
    .filter(Boolean);
  return out.length ? Array.from(new Set(out)) : undefined;
}
function deriveServicesFromData(data: any): string[] | undefined {
  try {
    const s1 = normalizeServicesList(data?.services);
    if (s1?.length) return s1;
    const s2 = normalizeServicesList(data?.meta?.services);
    if (s2?.length) return s2;
    return undefined;
  } catch {
    return undefined;
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  // --- 1) Template (tolerate missing rev) ---
  let t: any = null;
  let tErr: any = null;

  try {
    const r = await supabase
      .from('templates')
      .select('id, data, rev, site_id')
      .eq('id', id)
      .single();
    t = r.data;
    tErr = r.error;
  } catch (e: any) {
    tErr = e;
  }

  if (
    (!t || tErr) &&
    String(tErr?.message || '').toLowerCase().includes('column') &&
    String(tErr?.message || '').includes('rev')
  ) {
    const r2 = await supabase
      .from('templates')
      .select('id, data, site_id')
      .eq('id', id)
      .single();
    t = r2.data;
    tErr = r2.error;
    if (t) t.rev = 0;
  }

  if (tErr || !t) {
    return NextResponse.json({ error: tErr?.message ?? 'Template not found' }, { status: 404 });
  }

  const revNum = Number.isFinite(t.rev) ? Number(t.rev) : 0;
  const draftHash = sha256(t.data);

  // --- 2) Snapshots (newest-first) ---
  const { data: snaps } = await supabase
    .from('snapshots')
    .select('id, template_id, rev, data, hash, created_at')
    .eq('template_id', id)
    .order('created_at', { ascending: false });

  const snapshotsByRev = new Map<number, any>();
  for (const s of snaps ?? []) {
    if (typeof s?.rev === 'number') snapshotsByRev.set(s.rev, s);
  }

  const snapshots = (snaps ?? []).map((s) => ({
    id: s.id,
    rev: s.rev ?? 0,
    hash: s.hash || sha256(s.data),
    createdAt: s.created_at,
  }));

  const lastSnapshot = snapshots[0];

  // --- 3) Site (optional) ---
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
  } catch {}

  // --- 4) Versions (optional) ---
  let versions: Array<{ tag: string; snapshotId: string; notes?: string; createdAt?: string }> = [];
  try {
    if (snapshots.length > 0) {
      const { data: v } = await supabase
        .from('versions')
        .select('tag, snapshot_id, notes, created_at')
        .in('snapshot_id', snapshots.map((s) => s.id));
      if (v) {
        versions = v.map((r) => ({
          tag: r.tag,
          snapshotId: r.snapshot_id,
          notes: r.notes ?? undefined,
          createdAt: r.created_at,
        }));
      }
    }
  } catch {}

  // --- 5) Events (optional) ---
  let events: any[] = [];
  try {
    // Try selecting meta if present; fallback without it
    let evSel: any = await supabase
      .from('template_events')
      .select('id, type, at, rev_before, rev_after, actor, fields_touched, diff, meta')
      .eq('template_id', id)
      .order('at', { ascending: false })
      .limit(200);

    if (evSel.error && String(evSel.error.message || '').toLowerCase().includes('column') && evSel.error.message.includes('meta')) {
      evSel = await supabase
        .from('template_events')
        .select('id, type, at, rev_before, rev_after, actor, fields_touched, diff')
        .eq('template_id', id)
        .order('at', { ascending: false })
        .limit(200);
    }

    const ev = evSel.data ?? [];
    events = ev.map((e: any) => {
      // Prefer stored meta at event time
      let meta = e.meta ?? undefined;

      // If missing, try derive from the snapshot for that event's rev (no draft fallback)
      if (!meta) {
        const matchRev: number | undefined =
          (typeof e.rev_after === 'number' && e.rev_after) ||
          (typeof e.rev_before === 'number' && e.rev_before) ||
          undefined;

        const snap = matchRev != null ? snapshotsByRev.get(matchRev) : undefined;
        if (snap?.data) {
          const mIndustry = deriveIndustryFromData(snap.data);
          const mServices = deriveServicesFromData(snap.data);
          meta = mIndustry || mServices ? { industry: mIndustry, services: mServices } : undefined;
        }
      }

      return {
        id: e.id,
        type: e.type,
        at: e.at,
        revBefore: e.rev_before ?? undefined,
        revAfter: e.rev_after ?? undefined,
        actor: e.actor ?? undefined,
        fieldsTouched: e.fields_touched ?? undefined,
        diff: e.diff ?? undefined,
        meta, // event-time meta only; no current-draft fallback
      };
    });
  } catch {}

  // --- 6) Admin meta (optional) ---
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
  } catch {}

  const payload = {
    id: t.id,
    rev: revNum,
    hash: draftHash,
    infra: {
      template: { id: t.id, rev: revNum, hash: draftHash },
      site: site
        ? { id: site.id, slug: site.slug, publishedSnapshotId: site.published_snapshot_id }
        : undefined,
      lastSnapshot: lastSnapshot
        ? { id: lastSnapshot.id, rev: lastSnapshot.rev, hash: lastSnapshot.hash, createdAt: lastSnapshot.createdAt }
        : undefined,
      cache: null,
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
