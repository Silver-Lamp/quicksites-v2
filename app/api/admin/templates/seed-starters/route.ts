// app/api/admin/templates/seed-starters/route.ts
//
// The per-industry starter tool: seed starter templates for chosen industries — or
// ALL of them. Each starter = the industry scaffold + a charismatic business name,
// plus (for storefront industries with a curated product pack) a dedicated merchant
// and priced catalog wired into the grid; stamped meta.is_starter so the data-driven
// registry ("Duplicate a template" picker) surfaces them, and published for preview.
// Idempotent per slug — re-running skips everything that exists. No AI spend.
//
//   POST { all: true }                    → every industry except 'other'
//   POST { industries: ['crafts', ...] }  → just those
//
// Supersedes the crafts-only seed-crafts route (deleted; its specs moved into
// lib/builder/starterSeeds.ts). UI trigger: the "Seed starters" button on the
// templates list. Engine: lib/builder/seedStarterTemplate.ts.
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireUser';
import { seedStarterTemplate } from '@/lib/builder/seedStarterTemplate';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { KEY_TO_LABEL, toIndustryKey, type IndustryKey } from '@/lib/industries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // ~43 industries, sequential inserts + publish RPCs

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  let keys: IndustryKey[];
  if (body.all === true) {
    keys = (Object.keys(KEY_TO_LABEL) as IndustryKey[]).filter((k) => k !== 'other');
  } else if (Array.isArray(body.industries) && body.industries.length) {
    keys = Array.from(
      new Set(
        body.industries
          .map((k: any) => toIndustryKey(String(k)))
          .filter((k: IndustryKey) => k !== 'other'),
      ),
    );
  } else {
    return NextResponse.json({ error: 'Pass { all: true } or { industries: [...] }.' }, { status: 400 });
  }
  if (!keys.length) return NextResponse.json({ error: 'No valid industries.' }, { status: 400 });

  const results = [];
  for (const industryKey of keys) {
    results.push(await seedStarterTemplate({ industryKey, ownerId: gate.user.id }));
  }

  // The admin list reads the materialized view — refresh so new starters show up.
  try {
    await (supabaseAdmin as any).rpc('refresh_template_bases');
  } catch {
    /* best-effort */
  }

  return NextResponse.json({
    ok: results.every((r) => r.status !== 'failed'),
    created: results.filter((r) => r.status === 'created').length,
    exists: results.filter((r) => r.status === 'exists').length,
    failed: results.filter((r) => r.status === 'failed').length,
    withCatalogs: results.filter((r) => (r.items ?? 0) > 0).length,
    results,
  });
}
