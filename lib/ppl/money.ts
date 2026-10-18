// lib/ppl/money.ts — the one dollar formatter the pay-per-call surfaces share. Pure, no imports:
// a CLIENT component (the pitch console) imports it, and anything this file pulled in would be
// bundled for the browser. On 2026-10-18 the console imported `usd` from pitchPlan.ts, which
// had just gained an import that reached the Supabase admin client — "supabaseKey is required"
// on every load of /admin/ppl, both widths, for ~20 minutes.
export const usd = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
