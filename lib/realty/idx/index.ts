// lib/realty/idx/index.ts
//
// IDX listings client — resolves a template's per-agent feed config, picks the provider, runs the
// search, and attaches the MLS-mandated compliance block. The single entry point the proxy route
// calls. Flag-gated (docs/REALTY_IDX_PLAN.md); with the flag off (and no config) it serves the
// mock feed in non-production so the block/proxy are demoable, and returns disabled in production.

import { realtyIdxEnabled, realtyIdxMockAllowed } from '@/lib/flags/realtyIdx';
import type { IdxConfig, ListingResult, ListingSearch, ListingProvider } from './types';
import { mockProvider } from './mockProvider';
import { bridgeProvider } from './bridgeProvider';

const PROVIDERS: Record<IdxConfig['provider'], ListingProvider | undefined> = {
  mock: mockProvider,
  bridge: bridgeProvider,
  simplyrets: undefined, // Phase 3 — add adapter when we pilot SimplyRETS
  mlsgrid: undefined, //    Phase 3 — add adapter for multi-MLS scale
};

const DEFAULT_DISCLAIMER =
  'Listing data is provided for consumers’ personal, non-commercial use and may not be used for any purpose other than to identify prospective properties. Information deemed reliable but not guaranteed.';

/** Read the per-agent feed config off a template's meta.idx (Phase 1). Credentials stay server-side. */
export function resolveIdxConfig(template: any): IdxConfig | null {
  const idx = template?.data?.meta?.idx ?? template?.meta?.idx;
  if (!idx || typeof idx !== 'object') return null;
  const provider = ['mock', 'bridge', 'simplyrets', 'mlsgrid'].includes(idx.provider)
    ? idx.provider
    : null;
  if (!provider) return null;
  return {
    provider,
    dataset: typeof idx.dataset === 'string' ? idx.dataset : undefined,
    token: typeof idx.token === 'string' ? idx.token : undefined,
    baseUrl: typeof idx.baseUrl === 'string' ? idx.baseUrl : undefined,
    mlsName: typeof idx.mlsName === 'string' ? idx.mlsName : undefined,
    disclaimer: typeof idx.disclaimer === 'string' ? idx.disclaimer : undefined,
  };
}

export type IdxSearchOutcome =
  | { ok: true; result: ListingResult }
  | {
      ok: false;
      reason: 'disabled' | 'not_configured' | 'provider_unavailable' | 'error';
      message?: string;
    };

/**
 * Run a listings search for a template. Falls back to the mock feed when no real config is set AND
 * mock is allowed (non-prod or flag on) — so the block renders in dev/demo. Returns `disabled` in
 * production with no config + flag off.
 */
export async function searchListings(
  template: any,
  params: ListingSearch
): Promise<IdxSearchOutcome> {
  let config = resolveIdxConfig(template);

  if (!config) {
    if (!realtyIdxMockAllowed()) return { ok: false, reason: 'disabled' };
    config = { provider: 'mock', mlsName: 'Sample MLS (demo data)' };
  } else if (config.provider !== 'mock' && !realtyIdxEnabled()) {
    // A real provider is configured but the flag isn't on → don't hit the live feed.
    return { ok: false, reason: 'disabled' };
  }

  const provider = PROVIDERS[config.provider];
  if (!provider)
    return {
      ok: false,
      reason: 'provider_unavailable',
      message: `No adapter for ${config.provider}`,
    };

  try {
    const { listings, total } = await provider.search(config, params);
    return {
      ok: true,
      result: {
        listings,
        total,
        compliance: {
          disclaimer: config.disclaimer || DEFAULT_DISCLAIMER,
          mlsName: config.mlsName,
          fetchedAt: new Date().toISOString(),
        },
      },
    };
  } catch (e: any) {
    if (e?.message?.includes('not_configured')) return { ok: false, reason: 'not_configured' };
    return { ok: false, reason: 'error', message: e?.message || 'search failed' };
  }
}

export type { Listing, ListingSearch, ListingResult, IdxConfig } from './types';
