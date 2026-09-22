// lib/gsc/listProperties.ts
//
// Which Search Console properties can we actually read?
//
// The harvest used to iterate `gsc_tokens.domain` — one row per domain, written when something
// explicitly connected that domain. So a property the owner added in the GSC console himself was
// invisible to us: no row, no harvest, no measurement, and nothing anywhere said why.
// `sandonjurowski.com` was verified as siteOwner and simply never read.
//
// An OAuth grant is scoped to a GOOGLE ACCOUNT, not to a property, so one grant already answers
// `sites.list` for every property that account can see. Enumerating turns "someone must connect
// each domain" into "anything you add in the console is measured on the next run".
//
// ⚠️ THERE IS MORE THAN ONE ACCOUNT, AND THAT IS THE WHOLE REASON THIS IS NOT ONE CALL. Grants
// here see 45 properties (the business account) or 29 (the owner's personal one) — different
// sets, neither a superset. Asking one grant and calling it "our properties" would silently drop
// everything the other holds, which is exactly the bug this file exists to fix. So: ask EVERY
// distinct grant, union the results, and remember which grant answered for each property so the
// caller reads it with credentials that actually work.

import { google } from 'googleapis';
import { getValidOAuthClient } from '@/lib/gsc/getValidOAuthClient';

export type GscProperty = {
  /** The siteUrl exactly as Search Console spells it — `sc-domain:x.com` or `https://www.x.com/`. */
  siteUrl: string;
  permissionLevel: string;
  /** The `gsc_tokens.domain` whose grant listed it. Read this property with THAT grant. */
  viaGrant: string;
};

/** A grant row we can authenticate as. `domain` is the token's key, not necessarily a real site. */
export type GrantRef = { domain: string };

const READABLE = /owner|full|restricted/i;

/**
 * Union of every property visible to any grant. A grant that fails is skipped, never fatal: one
 * revoked token must not hide the other account's properties.
 */
export async function listAllProperties(
  grants: readonly GrantRef[],
  deps: { authFor?: typeof getValidOAuthClient } = {},
): Promise<{ properties: GscProperty[]; failedGrants: string[] }> {
  const authFor = deps.authFor ?? getValidOAuthClient;
  const byUrl = new Map<string, GscProperty>();
  const failedGrants: string[] = [];

  for (const grant of grants) {
    try {
      const auth = await authFor(grant.domain);
      const sc = google.searchconsole({ version: 'v1', auth });
      const rows = (await sc.sites.list({})).data.siteEntry ?? [];
      for (const r of rows) {
        const siteUrl = typeof r.siteUrl === 'string' ? r.siteUrl : '';
        const permissionLevel = typeof r.permissionLevel === 'string' ? r.permissionLevel : '';
        // `siteUnverifiedUser` can list a property it cannot query. Reading it would 403 per
        // domain and look like a broken harvest rather than a permission we never had.
        if (!siteUrl || !READABLE.test(permissionLevel)) continue;
        if (!byUrl.has(siteUrl)) byUrl.set(siteUrl, { siteUrl, permissionLevel, viaGrant: grant.domain });
      }
    } catch {
      failedGrants.push(grant.domain);
    }
  }

  return { properties: [...byUrl.values()], failedGrants };
}

/**
 * One grant per distinct credential. `gsc_tokens` holds 68 rows over 4 refresh tokens, so asking
 * every row would make 68 identical `sites.list` calls for 4 answers.
 */
export function distinctGrants<T extends { domain: string; refresh_token?: string | null }>(
  rows: readonly T[],
): GrantRef[] {
  const seen = new Set<string>();
  const out: GrantRef[] = [];
  for (const r of rows) {
    const key = r.refresh_token || `domain:${r.domain}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ domain: r.domain });
  }
  return out;
}
