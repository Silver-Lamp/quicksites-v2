// app/api/admin/menu-run/route.ts
//
// The menu run's two operations, admin-only.
//
//   GET  ?campaign=<id>[&lat=&lng=]  → the stop list, route-ordered from an optional start
//   POST { templateId, images[] }    → OCR the photographed menu and write it to the site
//
// Context: four of the five restaurants on renton-restaurant.com have no menu we can honestly
// publish — no menu among their Google listing photos, and no website to scrape. The OCR
// pipeline works (32 accurate items for Eyman's) and is simply starving for input. This is the
// endpoint a phone posts to from the restaurant's doorway.
//
// ⚠️ SPENDS: geocoding on GET (only for stops we haven't placed), and two metered OpenAI
// vision calls on POST. Both are per-stop and operator-triggered, never on a cron.
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireUser';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { buildMenuRun } from '@/lib/menu/menuRun';
import { MENU_BASE_DOMAIN } from '@/lib/menu/deliveredMenu';
import { geocodeAll } from '@/lib/route/geocodeAddress';
import { readMenuSections, writeMenuSections, restoreMenuCta, isPlaceholderOnly } from '@/lib/menu/menuBlocks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// gpt-4o vision over a couple of high-detail menu photographs is slow; the default serverless
// timeout would cut it off mid-read and look like an OCR failure.
export const maxDuration = 60;

export async function GET(req: Request) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  const url = new URL(req.url);
  const campaign = (url.searchParams.get('campaign') || '').trim();
  if (!campaign) return NextResponse.json({ error: 'campaign is required' }, { status: 400 });

  const lat = Number(url.searchParams.get('lat'));
  const lng = Number(url.searchParams.get('lng'));
  const start = Number.isFinite(lat) && Number.isFinite(lng) ? { latitude: lat, longitude: lng } : null;

  const { data: prospects } = await supabaseAdmin
    .from('outreach_prospects')
    .select('id, business_name, template_id, address, phone')
    .eq('geo_campaign_id', campaign)
    .not('template_id', 'is', null);

  const rows = prospects ?? [];
  if (!rows.length) return NextResponse.json({ stops: [] });

  const { data: templates } = await supabaseAdmin
    .from('templates')
    .select('id, slug, data')
    .in('id', rows.map((p: any) => p.template_id));

  // Geocode only when we have a start point to order from — otherwise it's a paid call whose
  // result nothing reads.
  let located = rows as any[];
  if (start) {
    const points = await geocodeAll(rows.map((p: any) => p.address || ''));
    located = rows.map((p: any, i: number) => ({
      ...p,
      latitude: points[i]?.latitude ?? null,
      longitude: points[i]?.longitude ?? null,
    }));
  }

  const stops = buildMenuRun(located, (templates ?? []) as any[], MENU_BASE_DOMAIN || 'delivered.menu', start);
  return NextResponse.json({ stops });
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const templateId = String(body?.templateId || '').trim();
  const images: string[] = Array.isArray(body?.images) ? body.images.slice(0, 4) : [];
  if (!templateId || !images.length) {
    return NextResponse.json({ error: 'templateId and images are required' }, { status: 400 });
  }
  // Base64 data URLs are passed straight to the vision API, which accepts them — so a menu
  // photograph never has to be stored in a public bucket just to be read once.
  if (!images.every((i) => typeof i === 'string' && i.startsWith('data:image/'))) {
    return NextResponse.json({ error: 'images must be data: URLs' }, { status: 400 });
  }

  const { data: tpl } = await supabaseAdmin
    .from('templates')
    .select('id, slug, rev, data')
    .eq('id', templateId)
    .maybeSingle();
  if (!tpl) return NextResponse.json({ error: 'template not found' }, { status: 404 });

  const { menuFromPhotos } = await import('@/lib/rebuild/menuFromPhotos');
  const extracted = await menuFromPhotos(images, gate.user.id);
  const sections = extracted?.sections ?? [];
  const itemCount = sections.flatMap((s: any) => s.items ?? []).length;

  // Refuse to write nothing. A blank menu and an invented menu are both wrong; if the photo
  // was unreadable the operator should retake it, not discover an empty menu later.
  if (!itemCount) {
    return NextResponse.json(
      { ok: false, error: 'no_menu_read', message: 'Could not read a menu from that photo. Try again with the whole menu in frame, in good light.' },
      { status: 422 },
    );
  }

  const before = readMenuSections(tpl.data);
  const replacedPlaceholder = isPlaceholderOnly(before);

  let next = writeMenuSections(tpl.data, sections);
  next = restoreMenuCta(next); // the strip blanked it; a real menu earns the button back

  const { commitTemplatePatch } = await import('@/lib/templates/commitTemplatePatch');
  const err = await commitTemplatePatch(tpl.id, (tpl as any).rev ?? 0, { data: next }, gate.user.id);
  if (err) return NextResponse.json({ ok: false, error: err }, { status: 500 });

  return NextResponse.json({
    ok: true,
    slug: tpl.slug,
    sections: sections.length,
    items: itemCount,
    replacedPlaceholder,
    preview: sections.slice(0, 3).map((s: any) => ({
      name: s.name,
      items: (s.items ?? []).slice(0, 4).map((i: any) => i.name),
    })),
  });
}
