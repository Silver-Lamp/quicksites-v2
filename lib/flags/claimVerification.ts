// lib/flags/claimVerification.ts
//
// Gates the claim-verification requirement (see docs/CLAIM_VERIFICATION_PLAN.md).
// OFF by default: claiming an operator draft transfers ownership on the signed token
// alone (legacy behavior). ON: ownership only transfers once the claimer has proven
// control of the business (SMS OTP to the listing phone, or an operator override).
export const CLAIM_VERIFICATION_ENABLED =
  process.env.CLAIM_VERIFICATION_ENABLED === '1' ||
  process.env.CLAIM_VERIFICATION_ENABLED === 'true';
