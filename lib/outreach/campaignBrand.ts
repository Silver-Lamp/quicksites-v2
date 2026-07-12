// lib/outreach/campaignBrand.ts
//
// Resolve the brand a geo campaign presents to prospects — name/logo (postcard + claim
// page), the link domain (claim + /r links), and the email sender. A campaign's org_id
// (nullable) selects an org from organizations_public; a null org_id (or a missing org)
// falls back to the QuickSites default. One source of truth so every prospect surface
// brands consistently. See docs/WHITE_LABEL_PLAN.md.

import { supabaseAdmin } from '@/lib/supabase/admin';
import { publicBaseUrl } from '@/lib/outreach/competitionPoster';

export type CampaignBrand = {
  orgId: string | null;
  name: string; // "CedarSites" | "QuickSites"
  slug: string | null;
  logoUrl: string | null;
  darkLogoUrl: string | null;
  baseUrl: string; // https://cedarsites.com | publicBaseUrl()
  emailFrom: string | null; // per-org sender ("Name <addr>"); inert until Resend domain verified
  supportEmail: string | null;
};

/** The org new campaigns default to (e.g. "cedarsites"), or null to default to QuickSites. */
export function defaultOutreachOrgSlug(): string | null {
  return process.env.OUTREACH_DEFAULT_ORG_SLUG || null;
}

function quicksitesBrand(): CampaignBrand {
  return {
    orgId: null, name: 'QuickSites', slug: null, logoUrl: null, darkLogoUrl: null,
    baseUrl: publicBaseUrl(), emailFrom: null, supportEmail: null,
  };
}

function hostToBase(host: string | null | undefined): string | null {
  if (!host) return null;
  const h = String(host).replace(/^https?:\/\//, '').replace(/\/+$/, '').trim();
  return h ? `https://${h}` : null;
}

const ORG_BRAND_COLS = 'id, slug, name, logo_url, dark_logo_url, canonical_host, primary_domain, email_from, support_email';

function rowToBrand(row: any): CampaignBrand {
  return {
    orgId: String(row.id),
    name: row.name || 'QuickSites',
    slug: row.slug ?? null,
    logoUrl: row.logo_url ?? null,
    darkLogoUrl: row.dark_logo_url ?? null,
    baseUrl: hostToBase(row.canonical_host || row.primary_domain) ?? publicBaseUrl(),
    emailFrom: row.email_from ?? null,
    supportEmail: row.support_email ?? null,
  };
}

/** Brand for a campaign's org_id (null → QuickSites default). Never throws. */
export async function resolveCampaignBrand(orgId: string | null | undefined): Promise<CampaignBrand> {
  if (!orgId) return quicksitesBrand();
  try {
    const { data } = await supabaseAdmin
      .from('organizations_public')
      .select(ORG_BRAND_COLS)
      .eq('id', orgId)
      .maybeSingle();
    return data ? rowToBrand(data) : quicksitesBrand();
  } catch {
    return quicksitesBrand();
  }
}

/** Look up an org id by slug (for the switch route + the create-time default). Null if none. */
export async function orgIdForSlug(slug: string): Promise<string | null> {
  const s = slug.trim().toLowerCase();
  if (!s) return null;
  try {
    const { data } = await supabaseAdmin
      .from('organizations_public')
      .select('id')
      .eq('slug', s)
      .maybeSingle();
    return data ? String((data as any).id) : null;
  } catch {
    return null;
  }
}
