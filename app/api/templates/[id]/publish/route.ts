// app/api/templates/[id]/publish/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { captureServer } from '@/lib/analytics/posthog-server';
import { EVENTS } from '@/lib/analytics/events';
import { resolvePublishTarget } from '@/lib/templates/publishTarget';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { version_id }: { version_id?: string } = await req.json().catch(() => ({}));

  const supa = await getServerSupabase();
  const {
    data: { user },
    error: userErr,
  } = await supa.auth.getUser();
  if (userErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Guests (anonymous users) can build but must sign up before going live.
  if (user.is_anonymous) {
    return NextResponse.json(
      { error: 'Sign up to publish your site.', code: 'needs_signup' },
      { status: 403 }
    );
  }

  // Resolve base_slug from id (UUID) or use value as base_slug
  let base_slug = id;
  if (UUID_V4.test(id)) {
    const { data: row, error } = await supabaseAdmin
      .from('templates')
      .select('base_slug')
      .eq('id', id)
      .maybeSingle();
    if (error || !row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    base_slug = row.base_slug;
  }

  // Load canonical
  const { data: c0, error: cErr } = await supabaseAdmin
    .from('templates')
    .select('id, owner_id, slug, custom_domain, claim_source')
    .eq('base_slug', base_slug)
    .eq('is_version', false)
    .maybeSingle();
  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 400 });

  // No canonical? A slugged row with no canonical sibling IS the canonical — see
  // lib/templates/publishTarget.ts for why 1,376 live sites were stuck unpublishable here.
  let self: typeof c0 = null;
  if (!c0) {
    // The route accepts a uuid OR a base_slug, so resolve "self" the same way.
    const selfQuery = supabaseAdmin
      .from('templates')
      .select('id, owner_id, slug, custom_domain, claim_source')
      .not('slug', 'is', null)
      .neq('slug', '');
    const r = await (UUID_V4.test(id)
      ? selfQuery.eq('id', id).maybeSingle()
      : selfQuery
          .eq('base_slug', base_slug)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle());
    self = r.data;
  }
  const c = resolvePublishTarget(c0, self);
  if (!c) return NextResponse.json({ error: 'Canonical not found' }, { status: 404 });

  // Owner or admin check
  const { data: adminRow } = await supabaseAdmin
    .from('admin_users')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!adminRow && c.owner_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Publish through the sanctioned RPC. A plain UPDATE here is rejected outright by
  // trg_guard_templates_update ("Direct updates to templates are blocked"), which is
  // exactly what this route used to do — so the Publish button returned a 400 carrying a
  // raw Postgres message, and every site live today was published by a script instead.
  //
  // The RPC also does the half a pointer-flip would have missed: it mints (or validates)
  // the snapshot and upserts published_sites, which is what the public render actually
  // serves. Setting `published` alone yields a site marked live with nothing behind it.
  const { data: snapshotId, error: upErr } = await supabaseAdmin.rpc('publish_template', {
    p_template_id: c.id,
    p_version_id: version_id ?? null,
    p_actor: user.id,
  });

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

  // Funnel: a site went live (docs/MODEL_A_PLAN.md A7). Best-effort; keyed to the
  // publisher so it stitches to their signup/builder-activated steps.
  try {
    await captureServer(
      EVENTS.SITE_PUBLISHED,
      { template_id: c.id, base_slug, owner_id: c.owner_id ?? null },
      user.id
    );
  } catch {}

  // Best-effort: tell search engines the page changed (IndexNow — Bing/Yandex/etc.).
  // No-op unless INDEXNOW_KEY is set, and only for sites with a resolvable public domain
  // (custom domain or delivered.menu); never blocks publish.
  try {
    const { publicIndexUrl, submitToIndexNow } = await import('@/lib/seo/indexNow');
    const url = publicIndexUrl(c);
    if (url) await submitToIndexNow([url]);
  } catch (e: any) {
    console.warn('IndexNow submit after publish failed:', e?.message || e);
  }

  // Best-effort: if the owner is on an agency plan, reconcile their per-site
  // subscription quantity now that a site went live. Never blocks publish;
  // the nightly cron is the source of truth.
  if (c.owner_id) {
    try {
      const { syncAgencySiteQuantity } = await import('@/lib/billing/agency');
      await syncAgencySiteQuantity(c.owner_id);
    } catch (e: any) {
      console.warn('agency site-quantity sync after publish failed:', e?.message || e);
    }
  }

  // Report the snapshot actually served, not the one that was asked for — when no version
  // is named the RPC mints a fresh one, and echoing back `null` would tell the caller
  // nothing was published.
  return NextResponse.json({ ok: true, published_version_id: snapshotId ?? version_id ?? null });
}
