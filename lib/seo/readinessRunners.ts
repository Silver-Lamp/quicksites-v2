// lib/seo/readinessRunners.ts
//
// SERVER-ONLY execution side of the readiness-actions registry. The registry
// (lib/seo/readinessActions.ts) is the pure, client-safe declaration of each one-click fix;
// this maps each action key to the server function that performs it — so the pipeline (and
// the HTTP routes) call the logic directly, never re-entering HTTP. Keep server imports here,
// not in the registry (which is bundled into client components).

import type { ReadinessActionKey } from '@/lib/seo/readinessActions';
import { fillOfficeAddress } from '@/lib/parks/fillOfficeAddress';
import { fillLocalBusinessSchema } from '@/lib/seo/fillLocalBusinessSchema';
import { getGeoCampaignByTemplateId } from '@/lib/outreach/geoCampaigns';
import { addCityServicePage } from '@/lib/seo/localPagesServer';

export type RunnerResult = { changed: boolean; reason?: string; error?: string; [k: string]: any };

export const READINESS_RUNNERS: Record<ReadinessActionKey, (templateId: string, actorId: string | null) => Promise<RunnerResult>> = {
  fill_office_address: (id, actor) => fillOfficeAddress(id, actor),
  fill_local_business_schema: (id, actor) => fillLocalBusinessSchema(id, actor),
  generate_city_page: async (id, actor) => {
    const c = await getGeoCampaignByTemplateId(id);
    if (!c) return { changed: false, reason: 'not_geo_site' };
    const r = await addCityServicePage({ template_id: c.template_id, city: c.city, industry_key: c.industry_key }, actor);
    return { changed: !!r.changed, reason: r.reason, slug: (r as any).slug };
  },
};
