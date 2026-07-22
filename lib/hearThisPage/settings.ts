// lib/hearThisPage/settings.ts
//
// Server-side load/save of the super-admin "Hear this page" config (Phase 2).
// Stored in site_settings (service-role only, RLS-denied) under `hear_this_page`.
// The pure types + normalizer live in ./config.ts (client-safe); this file is the DB seam.

import 'server-only';
import { getSiteSetting, setSiteSetting } from '@/lib/settings/siteSettings';
import {
  DEFAULT_SETTINGS,
  normalizeSettings,
  type HearThisPageSettings,
} from '@/lib/hearThisPage/config';

const KEY = 'hear_this_page';

/** Current config (normalized; falls back to the summary-everywhere default). */
export async function getHearThisPageSettings(): Promise<HearThisPageSettings> {
  const raw = await getSiteSetting<any>(KEY, DEFAULT_SETTINGS);
  return normalizeSettings(raw);
}

/** Persist a (normalized) config. Admin-gated at the route. */
export async function setHearThisPageSettings(
  next: HearThisPageSettings,
  updatedBy?: string | null,
): Promise<HearThisPageSettings> {
  const normalized = normalizeSettings(next);
  await setSiteSetting(KEY, normalized, updatedBy ?? null);
  return normalized;
}
