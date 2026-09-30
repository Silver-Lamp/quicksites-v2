// lib/ppl/cascadeFlag.ts
//
// The cascade's master switch, in its own module so the pure logic in `cascade.ts` stays
// testable without touching `process.env`.
//
// ⚠️ OFF BY DEFAULT, AND IT SHOULD STAY OFF UNTIL TWO THINGS ARE MEASURED
// (docs/CALL_CASCADE_PLAN.md §8): do callers hold through a 60-second cascade, and does any
// business press 1. Neither can be estimated — the product has had two genuine inbound calls in
// its history — and if acceptance is zero then Phase 0 alone is the better product and this
// should be pulled rather than tuned. Turning it on is how we find out, not a declaration that
// it works.
//
// ⚠️ Flipping it changes what a member of the public hears when they ring a live site. It is
// not a display toggle.
export function cascadeEnabled(): boolean {
  return process.env.CALL_CASCADE_ENABLED === '1' || process.env.CALL_CASCADE_ENABLED === 'true';
}
