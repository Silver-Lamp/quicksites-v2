// lib/flags/menuDemand.ts
//
// Gates demand capture on unclaimed delivered.menu drafts (Phase 1 of the
// "prove demand before signup" outreach idea). OFF by default: the watermarked
// draft renders exactly as today. ON: an unclaimed listing-import draft on the
// menu host logs order intent (tap-to-call + "order ahead" lead) and the claim
// bar escalates its pitch with the count. No money is captured or held — this is
// a demand signal only. See docs/RESTAURANT_VERTICAL.md.
export const MENU_DEMAND_CAPTURE_ENABLED =
  process.env.MENU_DEMAND_CAPTURE_ENABLED === '1' ||
  process.env.MENU_DEMAND_CAPTURE_ENABLED === 'true';

// Phase 2: when demand on a draft crosses the threshold, SMS the restaurant once
// ("N people tried to order — claim to turn it on"). Its own flag because cold B2B
// SMS carries deliverability/TCPA surface the pure counter doesn't. Requires Twilio env.
export const MENU_DEMAND_CAPTURE_SMS =
  process.env.MENU_DEMAND_CAPTURE_SMS === '1' ||
  process.env.MENU_DEMAND_CAPTURE_SMS === 'true';

/** Order-intents needed before we ping the restaurant (default 3). */
export function menuDemandNotifyThreshold(): number {
  const n = Number(process.env.MENU_DEMAND_NOTIFY_THRESHOLD);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 3;
}
