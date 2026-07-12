// lib/prospects/recentLocationsStore.ts
//
// Per-user server-side persistence for the "Businesses near me" recent-sweep list.
// Stored in site_settings under a per-operator key so recents follow the admin
// across devices/browsers (localStorage was per-browser only). Service-role only.

import { getSiteSetting, setSiteSetting } from '@/lib/settings/siteSettings';
import {
  addRecentLocation,
  normalizeRecentLocations,
  type RecentLocation,
} from '@/lib/prospects/recentLocations';

const KEY_PREFIX = 'prospects_recent_locations:';
const key = (userId: string) => `${KEY_PREFIX}${userId}`;

/** Read one operator's recent sweeps (newest first), normalized. Never throws. */
export async function getRecentLocations(userId: string): Promise<RecentLocation[]> {
  const raw = await getSiteSetting<unknown>(key(userId), []);
  return normalizeRecentLocations(raw);
}

/** Add/refresh one sweep at the front of an operator's list, capped + deduped. */
export async function addRecentLocationForUser(
  userId: string,
  entry: RecentLocation,
): Promise<RecentLocation[]> {
  const next = addRecentLocation(await getRecentLocations(userId), entry);
  await setSiteSetting(key(userId), next, userId);
  return next;
}

/** Clear an operator's recent sweeps. */
export async function clearRecentLocations(userId: string): Promise<void> {
  await setSiteSetting(key(userId), [], userId);
}
