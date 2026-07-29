// lib/outreach/directoryCandidates.ts
//
// "Who else could go on this city's ordering directory?"
//
// Answers the operator question the directory itself can't: the cohort is whatever was
// selected when the competition was created, and a city always has restaurants we built a
// site for that never made it onto the list — imported later, assigned to no campaign, or
// simply missed.
//
// Returns everything plausible WITH its disqualifying reason attached rather than filtering
// silently, because "why isn't X on here?" is the question this screen exists to answer. A
// buffet shows up flagged, not absent — the automatic rule is a default, and an operator who
// knows a particular buffet does a brisk takeaway trade should be able to override it.
import { supabaseAdmin } from '@/lib/supabase/admin';
import { menuSiteUrl } from '@/lib/menu/deliveredMenu';
import { assessOrderingFit } from '@/lib/prospects/orderingFit';
import { getHiddenTemplateIds, getExtraTemplateIds } from '@/lib/outreach/directoryCuration';

export type DirectoryCandidate = {
  templateId: string;
  slug: string;
  businessName: string;
  address: string | null;
  url: string;
  /** Already on the list. */
  onDirectory: boolean;
  /** Operator hid this one. */
  hidden: boolean;
  /** Pulled in manually rather than a cohort member. */
  extra: boolean;
  /** In the competition cohort for this campaign. */
  inCohort: boolean;
  /** Set when an automatic rule would exclude it — e.g. buffet. Advisory, overridable. */
  excludedReason?: string;
};

export async function loadDirectoryCandidates(campaignId: string): Promise<DirectoryCandidate[]> {
  const { data: campaign } = await supabaseAdmin
    .from('geo_industry_campaigns')
    .select('id, city, region')
    .eq('id', campaignId)
    .maybeSingle();
  if (!campaign) return [];

  const [hidden, extra] = await Promise.all([
    getHiddenTemplateIds(campaignId),
    getExtraTemplateIds(campaignId),
  ]);
  const hiddenSet = new Set(hidden);
  const extraSet = new Set(extra);

  // Cohort membership, so the UI can distinguish "in the contest" from "just on the list".
  const { data: cohortRows } = await supabaseAdmin
    .from('outreach_prospects')
    .select('template_id')
    .eq('geo_campaign_id', campaignId)
    .not('template_id', 'is', null);
  const cohortSet = new Set((cohortRows ?? []).map((r: any) => r.template_id));

  // Any restaurant site we built for this city. Matching on the ADDRESS rather than a city
  // column because outreach_prospects has no city field — the address is what we actually
  // captured from the listing.
  const city = String(campaign.city ?? '').trim();
  const { data: prospects } = await supabaseAdmin
    .from('outreach_prospects')
    .select('template_id, business_name, address')
    .not('template_id', 'is', null)
    .ilike('address', `%${city}%`);

  const byTemplate = new Map<string, { business_name: string | null; address: string | null }>();
  for (const p of prospects ?? []) {
    if (!byTemplate.has((p as any).template_id)) {
      byTemplate.set((p as any).template_id, {
        business_name: (p as any).business_name,
        address: (p as any).address,
      });
    }
  }
  // Extras may not be prospects at all — make sure a manually-added site still appears here,
  // otherwise it becomes un-removable from this screen.
  for (const id of extra) if (!byTemplate.has(id)) byTemplate.set(id, { business_name: null, address: null });

  const ids = [...byTemplate.keys()];
  if (!ids.length) return [];

  const { data: templates } = await supabaseAdmin
    .from('templates')
    .select('id, slug, business_name, data, claim_source')
    .in('id', ids);

  const out: DirectoryCandidate[] = [];
  for (const t of templates ?? []) {
    const meta = byTemplate.get((t as any).id) ?? { business_name: null, address: null };
    const name = (t as any).business_name || meta.business_name || (t as any).slug;
    const fit = assessOrderingFit({
      name,
      categories: (t as any)?.data?.meta?.services ?? (t as any)?.data?.services ?? [],
    });
    const isExtra = extraSet.has((t as any).id);
    const isHidden = hiddenSet.has((t as any).id);
    const inCohort = cohortSet.has((t as any).id);

    out.push({
      templateId: (t as any).id,
      slug: (t as any).slug,
      businessName: name,
      address: meta.address,
      url: menuSiteUrl((t as any).slug),
      // Mirrors the feed's logic exactly: hidden always loses; an extra overrides the
      // automatic rule; otherwise it's on if it's a cohort member and fits.
      onDirectory: !isHidden && (isExtra || (inCohort && fit.fits)),
      hidden: isHidden,
      extra: isExtra,
      inCohort,
      ...(fit.fits ? {} : { excludedReason: fit.reason }),
    });
  }

  return out.sort(
    (a, b) =>
      Number(b.onDirectory) - Number(a.onDirectory) || a.businessName.localeCompare(b.businessName),
  );
}
