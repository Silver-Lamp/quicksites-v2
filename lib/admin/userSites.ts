// lib/admin/userSites.ts
//
// What a user has BUILT, summarised for /admin/users. The list page grew up in the commerce era
// (chef / merchant / compliance columns) and said nothing about sites, which is what a new
// signup on the builder actually does. Pure: the route fetches rows, this shapes them.
import { publicSiteUrl } from '@/lib/sites/publicUrl';

export type OwnedTemplateRow = {
  id: string;
  owner_id: string | null;
  slug: string | null;
  template_name?: string | null;
  business_name?: string | null;
  published?: boolean | null;
  updated_at?: string | null;
  created_at?: string | null;
  custom_domain?: string | null;
  claim_source?: string | null;
  industry?: string | null;
};

export type UserSiteBrief = {
  id: string;
  name: string;
  slug: string | null;
  url: string | null;
  published: boolean;
  updated_at: string | null;
  custom_domain: string | null;
  /** How it came to exist: 'guest_build' | 'listing_import' | 'demo_seed' | null (the editor). */
  claim_source: string | null;
  industry: string | null;
};

export type UserSitesSummary = {
  total: number;
  published: number;
  drafts: number;
  custom_domains: number;
  /** Most recent template update, across all the user's sites. */
  last_edited_at: string | null;
  first_created_at: string | null;
  /** Newest-edited first, capped — enough to see what they are working on. */
  latest: UserSiteBrief[];
};

export const LATEST_SITES_PER_USER = 5;

const later = (a: string | null | undefined, b: string | null | undefined) => (!a ? b ?? null : !b ? a : a > b ? a : b);
const earlier = (a: string | null | undefined, b: string | null | undefined) => (!a ? b ?? null : !b ? a : a < b ? a : b);

function brief(t: OwnedTemplateRow): UserSiteBrief {
  return {
    id: t.id,
    name: (t.business_name || t.template_name || t.slug || 'Untitled').toString(),
    slug: t.slug ?? null,
    url: publicSiteUrl({ custom_domain: t.custom_domain ?? null, slug: t.slug ?? null }),
    published: !!t.published,
    updated_at: t.updated_at ?? null,
    custom_domain: t.custom_domain ?? null,
    claim_source: t.claim_source ?? null,
    industry: t.industry ?? null,
  };
}

/** Group a batch of template rows by owner and summarise each owner's sites. */
export function summarizeUserSites(rows: OwnedTemplateRow[], limitLatest = LATEST_SITES_PER_USER): Map<string, UserSitesSummary> {
  const byOwner = new Map<string, OwnedTemplateRow[]>();
  for (const r of rows) {
    if (!r.owner_id) continue;
    const list = byOwner.get(r.owner_id) ?? [];
    list.push(r);
    byOwner.set(r.owner_id, list);
  }
  const out = new Map<string, UserSitesSummary>();
  for (const [owner, list] of byOwner) {
    const sorted = [...list].sort((a, b) => String(b.updated_at ?? '').localeCompare(String(a.updated_at ?? '')));
    let published = 0;
    let customDomains = 0;
    let lastEdited: string | null = null;
    let firstCreated: string | null = null;
    for (const t of sorted) {
      if (t.published) published++;
      if (t.custom_domain) customDomains++;
      lastEdited = later(lastEdited, t.updated_at);
      firstCreated = earlier(firstCreated, t.created_at);
    }
    out.set(owner, {
      total: sorted.length,
      published,
      drafts: sorted.length - published,
      custom_domains: customDomains,
      last_edited_at: lastEdited,
      first_created_at: firstCreated,
      latest: sorted.slice(0, limitLatest).map(brief),
    });
  }
  return out;
}

/** The empty summary, so a row with no sites still has a shape the UI can render. */
export const NO_SITES: UserSitesSummary = { total: 0, published: 0, drafts: 0, custom_domains: 0, last_edited_at: null, first_created_at: null, latest: [] };

/** Which sign-in method an auth user has — from Supabase's app metadata; 'anonymous' for a guest. */
export function authProvider(u: { is_anonymous?: boolean | null; app_metadata?: { provider?: string; providers?: string[] } | null }): string {
  if (u.is_anonymous) return 'anonymous';
  const p = u.app_metadata?.provider || u.app_metadata?.providers?.[0];
  return p ? String(p) : 'unknown';
}
