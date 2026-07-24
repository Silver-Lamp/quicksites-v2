// lib/flags/secondset.ts
//
// Feature flag for SecondSet — the AR-glasses service-transparency layer (see
// docs/SECONDSET_GLASSES_PLAN.md). Default OFF: the service_jobs model, the
// glasses-capture ingest, and the customer-portal approval surfaces are all inert
// until this is set. Flipping it on is a deliberate step gated on the load-bearing
// pilot prerequisites — privacy/consent flow signed off, and hardware/spend
// greenlit by the owner for a specific pilot shop.
//
// To enable in an environment: set SECONDSET_ENABLED=1 (server-side).

export const SECONDSET_ENABLED =
  process.env.SECONDSET_ENABLED === '1' || process.env.SECONDSET_ENABLED === 'true';
