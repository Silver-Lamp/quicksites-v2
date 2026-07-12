// lib/flags/outreachReadinessGate.ts
//
// Feature flag for the refine-before-postcard readiness gate.
//
// Server-side, default OFF. Until flipped on, Mail/Text send routes behave exactly as
// before (a campaign can be mailed regardless of readiness) — the readiness UI and
// auto-blockers still compute and display, they just don't *block* the send. Flip on
// once operators are used to marking sites refined, so an unrefined site can't be mailed.
//
// To turn on: set OUTREACH_READINESS_GATE_ENABLED=1 (server-only).
export function outreachReadinessGateEnabled(): boolean {
  return (
    process.env.OUTREACH_READINESS_GATE_ENABLED === '1' ||
    process.env.OUTREACH_READINESS_GATE_ENABLED === 'true'
  );
}
