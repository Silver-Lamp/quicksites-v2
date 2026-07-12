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

/** The org identity a campaign site inherits until a real operator sets its own. */
export type OrgIdentity = {
  /** "Serving Renton, WA & nearby" — null when the org has no service-area city. */
  label: string | null;
  phone: string | null;
  /** Where contact-form leads from an unclaimed pitch site should go (bare address). */
  email: string | null;
};

/** "Serving Renton, WA & nearby" from a stored org address. Null when there's no city. */
export function serviceAreaLabel(addr: OrgAddress | null | undefined): string | null {
  const city = (addr?.city ?? '').trim();
  const region = (addr?.region ?? '').trim();
  if (!city) return null;
  return region ? `Serving ${city}, ${region} & nearby` : `Serving ${city} & nearby`;
}

/** Pull a bare recipient address from support_email, else the address inside email_from. */
export function pickOrgRecipientEmail(supportEmail?: string | null, emailFrom?: string | null): string | null {
  const support = (supportEmail ?? '').trim();
  if (support) return support.toLowerCase();
  const from = (emailFrom ?? '').trim();
  if (!from) return null;
  const m = from.match(/<([^>]+)>/); // "Name <addr@x>" → addr@x
  const addr = (m ? m[1] : from).trim();
  return addr.includes('@') ? addr.toLowerCase() : null;
}

/**
 * Read one org's inheritable identity (service-area label + phone + contact recipient) for
 * seeding onto its campaign pitch sites. Null when the org provides nothing useful.
 */
export async function getOrgIdentity(orgId: string | null | undefined): Promise<OrgIdentity | null> {
  if (!orgId) return null;
  try {
    const { data } = await supabaseAdmin
      .from('organizations')
      .select('branding, support_email, email_from')
      .eq('id', orgId)
      .maybeSingle();
    const addr = ((data as any)?.branding?.address ?? null) as OrgAddress | null;
    const label = serviceAreaLabel(addr);
    const email = pickOrgRecipientEmail((data as any)?.support_email, (data as any)?.email_from);
    const phone = (addr?.phone ?? '').trim() || null;
    if (!label && !email) return null; // nothing to inherit
    return { label, phone, email };
  } catch {
    return null;
  }
}
