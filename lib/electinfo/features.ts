// lib/electinfo/features.ts
export type FeatureCode = 'donations' | 'events' | 'newsletter' | 'endorsements' | 'issues' | 'volunteer';

export type Entitlements = Record<FeatureCode, boolean>;

export const DEFAULT_FREE: Entitlements = {
  donations: false,
  events: false,
  newsletter: false,
  endorsements: false,
  issues: true,       // keep About/Issues free
  volunteer: false,    // keep volunteer/contact free
};
