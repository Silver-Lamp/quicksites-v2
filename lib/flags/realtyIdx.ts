// lib/flags/realtyIdx.ts
//
// Feature flag for the real-estate IDX / MLS live-listings integration (docs/REALTY_IDX_PLAN.md).
// Default OFF — IDX data is licensed per-agent-per-MLS with mandatory display compliance, so it may
// only run where a real feed + license is in place. Until flipped on, the listings proxy returns
// disabled and the listing_search block shows a "connect a feed" note (or the mock feed in dev).
//
// PREREQUISITES to enable in an environment:
//   1. A pilot agent with an approved MLS IDX feed + signed data license.
//   2. A provider account (Bridge Interactive / SimplyRETS / MLS Grid) + credentials.
//   3. Per-agent feed config on template.data.meta.idx (provider/dataset/token/disclaimer).

export function realtyIdxEnabled(): boolean {
  return process.env.REALTY_IDX_ENABLED === '1' || process.env.REALTY_IDX_ENABLED === 'true';
}

/** Allow the mock provider to serve sample listings in non-production even when the flag is off,
 *  so the block + proxy can be built/demoed without a real feed. Never in production. */
export function realtyIdxMockAllowed(): boolean {
  return realtyIdxEnabled() || process.env.NODE_ENV !== 'production';
}
