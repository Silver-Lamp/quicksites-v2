// lib/outreach/directoryCuration.ts
//
// Operator curation for a city ordering directory (<city>-restaurant.com).
//
// Two rules decide who appears, and they're deliberately separate:
//
//   AUTOMATIC — lib/prospects/orderingFit.ts drops buffets: dine-in by construction, so an
//               ordering list is the wrong surface for them.
//   MANUAL    — this module. The operator hides a specific restaurant, or pulls in one the
//               cohort missed.
//
// ⚠️ DIRECTORY-ONLY, BY DESIGN. Hiding a restaurant removes it from the public list and
// nothing else: it stays in the competition cohort, keeps its own site, and keeps receiving
// outreach. Curating a storefront and deciding who to pitch are different decisions, and
// conflating them would mean a display tweak silently dropped someone from a campaign.
//
// Stored in `site_settings` rather than a new column, mirroring the homepage showcase, which
// keeps its hide/order lists the same way (lib/home/getShowcaseData.ts). Same shape, same
// service-role-only table, no migration.
import { getSiteSetting, setSiteSetting } from '@/lib/settings/siteSettings';

const HIDDEN_KEY = (campaignId: string) => `restaurant_directory_hidden:${campaignId}`;
const EXTRA_KEY = (campaignId: string) => `restaurant_directory_extra:${campaignId}`;

/** Template ids the operator has hidden from this directory. */
export async function getHiddenTemplateIds(campaignId: string): Promise<string[]> {
  const v = await getSiteSetting<string[]>(HIDDEN_KEY(campaignId), []);
  return Array.isArray(v) ? v.filter((s) => typeof s === 'string') : [];
}

/**
 * Template ids the operator has pulled IN that aren't in the cohort.
 *
 * Kept separate from the cohort for the same reason hiding is directory-only: appearing on a
 * city's list is not the same as being enrolled in its domain competition, and adding a
 * restaurant to a storefront shouldn't quietly enrol them in a contest they never entered.
 */
export async function getExtraTemplateIds(campaignId: string): Promise<string[]> {
  const v = await getSiteSetting<string[]>(EXTRA_KEY(campaignId), []);
  return Array.isArray(v) ? v.filter((s) => typeof s === 'string') : [];
}

export async function hideTemplate(campaignId: string, templateId: string, actor?: string | null) {
  const cur = await getHiddenTemplateIds(campaignId);
  if (cur.includes(templateId)) return;
  await setSiteSetting(HIDDEN_KEY(campaignId), [...cur, templateId], actor);
}

export async function showTemplate(campaignId: string, templateId: string, actor?: string | null) {
  const cur = await getHiddenTemplateIds(campaignId);
  if (!cur.includes(templateId)) return;
  await setSiteSetting(HIDDEN_KEY(campaignId), cur.filter((id) => id !== templateId), actor);
}

export async function addExtraTemplate(campaignId: string, templateId: string, actor?: string | null) {
  const cur = await getExtraTemplateIds(campaignId);
  if (cur.includes(templateId)) return;
  await setSiteSetting(EXTRA_KEY(campaignId), [...cur, templateId], actor);
  // Pulling one in should also un-hide it — otherwise "add" appears to do nothing when the
  // operator had hidden it earlier and forgotten.
  await showTemplate(campaignId, templateId, actor);
}

export async function removeExtraTemplate(campaignId: string, templateId: string, actor?: string | null) {
  const cur = await getExtraTemplateIds(campaignId);
  if (!cur.includes(templateId)) return;
  await setSiteSetting(EXTRA_KEY(campaignId), cur.filter((id) => id !== templateId), actor);
}
