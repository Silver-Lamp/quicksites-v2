// app/api/templates/starters/route.ts
//
// Display data for the curated starter templates shown in the new-site
// "Duplicate a template" picker. Read-only; returns only safe fields in
// curated order. Duplication itself goes through /api/templates/duplicate.

import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { STARTER_TEMPLATE_SLUGS } from '@/lib/builder/starter-templates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function prettifySlug(slug: string): string {
  const s = (slug || '').replace(/[-_]+/g, ' ').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : slug;
}

function firstNonEmpty(...vals: Array<string | null | undefined>): string | null {
  for (const v of vals) if (v && v.trim()) return v;
  return null;
}

/** Pull a hero image from a site's `data` JSON (top-level hero_url is often empty). */
function extractHeroImage(data: unknown): string | null {
  if (!data) return null;
  let text: string;
  try {
    text = typeof data === 'string' ? data : JSON.stringify(data);
  } catch {
    return null;
  }
  const urls = text.match(/https?:\/\/[^"'\\\s]+\.(?:png|jpe?g|webp)/gi);
  if (!urls?.length) return null;
  return urls.find((u) => /\/hero\//i.test(u)) || urls[0];
}

export async function GET() {
  try {
    const supa = await getServerSupabase({ serviceRole: true });
    const SELECT =
      'slug, template_name, business_name, industry_label, industry, hero_url, logo_url, data';

    // Two sources, merged: the hand-curated slug list (display order preserved,
    // legacy) + every template STAMPED as a starter (data.meta.is_starter) — the
    // data-driven layer, so seeding a new per-industry starter needs no code change.
    const [curatedRes, stampedRes] = await Promise.all([
      STARTER_TEMPLATE_SLUGS.length
        ? (supa as any)
            .from('templates')
            .select(SELECT)
            .in('slug', STARTER_TEMPLATE_SLUGS)
            .eq('is_site', true)
            .eq('published', true)
            .eq('archived', false)
            .eq('is_version', false)
        : Promise.resolve({ data: [] }),
      (supa as any)
        .from('templates')
        .select(SELECT)
        .eq('data->meta->>is_starter', 'true')
        .eq('published', true)
        .eq('archived', false)
        .eq('is_version', false)
        .order('created_at', { ascending: true })
        .limit(60),
    ]);

    const curated = (curatedRes?.data || []) as any[];
    const stamped = (stampedRes?.data || []) as any[];

    const bySlug = new Map<string, any>(curated.map((r: any) => [r.slug, r]));
    const ordered: any[] = STARTER_TEMPLATE_SLUGS.map((slug) => bySlug.get(slug)).filter(Boolean);
    for (const r of stamped) {
      if (!ordered.some((x) => x.slug === r.slug)) ordered.push(r);
    }

    const templates = ordered.map((r: any) => ({
      slug: r.slug,
      name: firstNonEmpty(r.business_name, r.template_name) || prettifySlug(r.slug),
      industry: r.industry_label || r.industry || null,
      heroUrl: firstNonEmpty(r.hero_url) || extractHeroImage(r.data),
    }));

    return NextResponse.json({ templates });
  } catch {
    return NextResponse.json({ templates: [] });
  }
}
