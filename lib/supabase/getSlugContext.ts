'use server';

import { headers as getHeaders, cookies as getCookies } from 'next/headers';
import { lookupSlugByHost } from '../supabase/lookupSlugByHost';
import { lookupTenantBySlug } from '../supabase/lookupTenantBySlug';

export type SlugContext = {
  slug: string;
  source: 'header' | 'cookie' | 'host' | 'lookup' | 'default';
  host: string;
  domain?: string;
  tenantId?: string | null;
};

type Options = {
  subdomainSlugMode?: boolean;
  resolveTenantId?: boolean;
  headersOverride?: Headers;
  cookiesOverride?: ReturnType<typeof getCookies>;
};

/**
 * Resolves a context-aware slug from headers, cookies, or fallback Supabase lookup.
 * Supports subdomain parsing and tenant ID resolution.
 */
export async function getSlugContext({
  subdomainSlugMode = true,
  resolveTenantId = false,
  headersOverride,
  cookiesOverride,
}: Options = {}): Promise<SlugContext> {
  const headers = headersOverride || (getHeaders() as unknown as Headers);
  const cookies = cookiesOverride || (getCookies() as unknown as ReturnType<typeof getCookies>);

  const rawHost = headers.get('x-forwarded-host') || headers.get('host') || '';
  const host = rawHost.toLowerCase().trim();
  const domain = host.replace(/^www\./, '');

  // 1. Try explicit header (e.g. from reverse proxy or middleware)
  const slugFromHeader =
    headers.get('x-site-slug') ||
    (subdomainSlugMode ? host.split('.')[0] : null);

  // 2. Try cookie (e.g. SSR remember-slug)
  const slugFromCookie = (await cookies).get('site_slug')?.value ?? null;

  // 3. DB fallback via Supabase
  const slugFromLookup = await lookupSlugByHost(host);

  const slug =
    slugFromHeader ||
    slugFromCookie ||
    slugFromLookup ||
    'default';

  const source = slugFromHeader
    ? 'header'
    : slugFromCookie
    ? 'cookie'
    : slugFromLookup
    ? 'lookup'
    : 'default';

  // 4. Optional: resolve tenant ID from slug
  let tenantId: string | null = null;

  if (resolveTenantId && slug !== 'default') {
    tenantId = await lookupTenantBySlug(slug); // implement as needed
  }

  return {
    slug,
    source,
    host,
    domain,
    tenantId,
  };
}
