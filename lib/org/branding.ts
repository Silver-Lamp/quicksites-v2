// lib/org/branding.ts
//
// Pure white-label brand mapping, extracted from the /api/org/branding route so
// the eligibility gate + response shape can be unit-tested without next/headers
// or Supabase. See docs/WHITE_LABEL_PLAN.md (Slice 0 foundation).
import type { Org } from './resolveOrg';

/** The public branding payload the login / join / register surfaces consume. */
export type OrgBrandingPayload = {
  branded: true;
  slug: string;
  name: string;
  logo_url: string | null;
  // Callers expect `logo_dark_url`; the Org model calls it `dark_logo_url`. We
  // emit both so every consumer (LoginForm, useOrgBranding, register) resolves it.
  logo_dark_url: string | null;
  dark_logo_url: string | null;
  favicon_url: string | null;
  theme_json: any;
  support_email: string | null;
  billing_mode: Org['billing_mode'];
};

/**
 * Map a resolved org to its public branding payload, or null when the org isn't
 * eligible to white-label. Only a `reseller` org rebrands the auth surface;
 * central/default/none orgs return null so the route replies 404 and clients
 * fall through to QuickSites defaults (identical to the pre-endpoint behavior).
 */
export function buildOrgBranding(org: Org): OrgBrandingPayload | null {
  if (org.billing_mode !== 'reseller') return null;
  return {
    branded: true,
    slug: org.slug,
    name: org.name,
    logo_url: org.logo_url ?? null,
    logo_dark_url: org.dark_logo_url ?? null,
    dark_logo_url: org.dark_logo_url ?? null,
    favicon_url: org.favicon_url ?? null,
    theme_json: org.theme_json ?? {},
    support_email: org.support_email ?? null,
    billing_mode: org.billing_mode,
  };
}
