// lib/outreach/orgServiceArea.ts
//
// An org's service-area contact, stored in organizations.branding.address and used to
// auto-point org-branded geo-sites at the org's location until a real operator sets their
// own. Deliberately a *service area* ("Serving Renton, WA & nearby"), not a street NAP —
// one address across many verticals is a local-spam footprint (see the ranking note in
// docs/RANKED_TARGETING_PLAN.md §5 discussion).

import { supabaseAdmin } from '@/lib/supabase/admin';

export type OrgAddress = {
  line1?: string | null;
  city?: string | null;
  region?: string | null; // state/province
  postal?: string | null;
  phone?: string | null;
};

export type OrgServiceArea = { label: string; phone: string | null };

/** "Serving Renton, WA & nearby" from a stored org address. Null when there's no city. */
export function serviceAreaLabel(addr: OrgAddress | null | undefined): string | null {
  const city = (addr?.city ?? '').trim();
  const region = (addr?.region ?? '').trim();
  if (!city) return null;
  return region ? `Serving ${city}, ${region} & nearby` : `Serving ${city} & nearby`;
}

/** Read one org's service-area (label + phone) from branding.address. Null when unset. */
export async function getOrgServiceArea(orgId: string | null | undefined): Promise<OrgServiceArea | null> {
  if (!orgId) return null;
  try {
    const { data } = await supabaseAdmin
      .from('organizations')
      .select('branding')
      .eq('id', orgId)
      .maybeSingle();
    const addr = ((data as any)?.branding?.address ?? null) as OrgAddress | null;
    const label = serviceAreaLabel(addr);
    if (!label) return null;
    return { label, phone: (addr?.phone ?? '').trim() || null };
  } catch {
    return null;
  }
}
