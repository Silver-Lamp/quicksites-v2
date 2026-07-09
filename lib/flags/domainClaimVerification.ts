// lib/flags/domainClaimVerification.ts
//
// Email proof-of-control for the DOMAIN-claim path (app/api/claim-site). When
// OFF (default), claim-site stays the hardened pending stub (no privileged
// writes). When ON, a claimer must pass an email OTP before the claim completes.
// Distinct from CLAIM_VERIFICATION_ENABLED, which gates the SMS operator-draft
// (delivered.menu) claim. See docs/DOMAIN_CLAIM_VERIFICATION_PLAN.md.
export const DOMAIN_CLAIM_VERIFICATION_ENABLED =
  process.env.DOMAIN_CLAIM_VERIFICATION_ENABLED === '1' ||
  process.env.DOMAIN_CLAIM_VERIFICATION_ENABLED === 'true';
