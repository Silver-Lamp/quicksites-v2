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
  if (!STARTER_TEMPLATE_SLUGS.length) return NextResponse.json({ templates: [] });
  try {
    const supa = await getServerSupabase({ serviceRole: true });
    const { data, error } = await (supa as any)
      .from('templates')
      .select('slug, template_name, business_name, industry_label, industry, hero_url, logo_url, data')
      .in('slug', STARTER_TEMPLATE_SLUGS)
      .eq('is_site', true)
      .eq('published', true)
      .eq('archived', false)
      .eq('is_version', false);
    if (error) return NextResponse.json({ templates: [] });

    const bySlug = new Map<string, any>((data || []).map((r: any) => [r.slug, r]));
    const templates = STARTER_TEMPLATE_SLUGS
      .map((slug) => bySlug.get(slug))
      .filter(Boolean)
      .map((r: any) => ({
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
