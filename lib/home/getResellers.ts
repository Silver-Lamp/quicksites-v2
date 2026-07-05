// lib/home/getResellers.ts
//
// Featured reseller orgs for the homepage reseller diagram, data-driven from
// `organizations_public` so the diagram reflects the real org (name / domain /
// accent) instead of hardcoded strings. A curated slug list (like the showcase's
// FEATURED_SITE_SLUGS) because no org is flagged `billing_mode='reseller'` yet.
import { getServerSupabase } from '@/lib/supabase/server';

export const FEATURED_RESELLER_SLUGS = ['cedarsites'];

export type ResellerBrand = {
  slug: string;
  name: string;
  domain: string | null;
  /** validated #RRGGBB, or null (the diagram falls back to the platform accent) */
  accent: string | null;
};

const HEX = /^#[0-9a-fA-F]{6}$/;

export async function getResellers(): Promise<ResellerBrand[]> {
  try {
    const supabase = await getServerSupabase();
    const { data } = await supabase
      .from('organizations_public')
      .select('slug, name, branding, primary_domain, canonical_host')
      .in('slug', FEATURED_RESELLER_SLUGS);

    const bySlug = new Map((data ?? []).map((o: any) => [o.slug, o]));
    // Preserve the curated order; drop any slug missing from the DB.
    return FEATURED_RESELLER_SLUGS.flatMap((slug) => {
      const o = bySlug.get(slug);
      if (!o) return [];
      const b = (o.branding || {}) as any;
      const raw = b?.colors?.primary;
      const accent = typeof raw === 'string' && HEX.test(raw) ? raw : null;
      return [
        {
          slug,
          name: b?.name || o.name || slug,
          domain: b?.domain || o.primary_domain || o.canonical_host || null,
          accent,
        },
      ];
    });
  } catch {
    return [];
  }
}
