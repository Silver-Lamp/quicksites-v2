// app/api/templates/[id]/history/route.ts
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server/supabaseAdmin';

type TemplateEvent = {
  id: string;
  type: 'open' | 'autosave' | 'save' | 'snapshot' | 'publish';
  at: string; // ISO
  revBefore?: number;
  revAfter?: number;
  actor?: { id?: string; name?: string; email?: string };
  fieldsTouched?: string[];
  diff?: { added?: number; changed?: number; removed?: number };
  meta?: Record<string, unknown>;
};

function ok(data: any, init?: number | ResponseInit) {
  const resInit = typeof init === 'number' ? { status: init } : init;
  return NextResponse.json(data, resInit);
}
function err(message: string, status = 500) {
  return ok({ error: message }, status);
}
function isMissingRelation(msg?: string | null) {
  const m = String(msg || '').toLowerCase();
  return (m.includes('relation') && m.includes('does not exist')) || m.includes('not exist');
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> } // 👈 Next 15: params is a Promise
) {
  const { id } = await ctx.params;          // 👈 must await
  const templateId = id;
  if (!templateId) return err('missing id', 400);

  const pub = supabaseAdmin.schema('public');

  // 1) Preferred: explicit events table, if present
  let events: TemplateEvent[] = [];
  {
    const { data, error } = await pub
      .from('template_events')
      .select(`
        id, template_id, type, created_at,
        rev_before, rev_after, actor_id, actor_name, actor_email,
        fields_touched, diff, meta
      `)
      .eq('template_id', templateId)
      .order('created_at', { ascending: false })
      .limit(300);

    if (error && !isMissingRelation(error.message)) return err(error.message);

    if (Array.isArray(data) && data.length) {
      events = data.map((r: any) => ({
        id: r.id,
        type: (r.type ?? 'save') as TemplateEvent['type'],
        at: r.created_at,
        revBefore: r.rev_before ?? undefined,
        revAfter: r.rev_after ?? undefined,
        actor:
          r.actor_id || r.actor_name || r.actor_email
            ? { id: r.actor_id ?? undefined, name: r.actor_name ?? undefined, email: r.actor_email ?? undefined }
            : undefined,
        fieldsTouched: Array.isArray(r.fields_touched) ? r.fields_touched : undefined,
        diff: r.diff ?? undefined,
        meta: r.meta ?? undefined,
      }));
    }
  }

  // 2) If none, synthesize snapshot events from template_versions
  if (events.length === 0) {
    const { data, error } = await pub
      .from('template_versions')
      .select('id, template_id, saved_at, rev, full_data')
      .eq('template_id', templateId)
      .order('saved_at', { ascending: false })
      .limit(100);

    if (error && !isMissingRelation(error.message)) return err(error.message);

    if (Array.isArray(data)) {
      events = data.map((v: any) => ({
        id: v.id,
        type: 'snapshot',
        at: v.saved_at ?? new Date().toISOString(),
        revAfter: typeof v.rev === 'number' ? v.rev : undefined,
        meta: { snapshot: { id: v.id, data: v.full_data } },
      }));
    }
  }

  // 3) Optionally prepend a publish event from sites linkage
  try {
    const { data: sites, error: sitesErr } = await pub
      .from('sites')
      .select('id, slug, published_snapshot_id, published_at, template_id')
      .eq('template_id', templateId)
      .limit(1);

    if (!sitesErr && Array.isArray(sites) && sites[0]?.published_snapshot_id) {
      const s = sites[0];
      events.unshift({
        id: `publish-${s.published_snapshot_id}`,
        type: 'publish',
        at: s.published_at ?? new Date().toISOString(),
        meta: { snapshotId: s.published_snapshot_id, site: { id: s.id, slug: s.slug } },
      });
    }
  } catch {
    // non-fatal
  }

  // Return a raw array (your client expects an array)
  return ok(events);
}
