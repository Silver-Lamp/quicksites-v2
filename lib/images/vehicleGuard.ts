// lib/images/vehicleGuard.ts
//
// ⚠️ "TOO MANY WHITE VANS IN GENERATED IMAGES" (owner, 2026-10-23). A consultant's hero, described
// as "Web Hosting Consulting", came back as a server room with two white vans parked in it. The
// prompt said "a small business" and "Show context of: Consulting, Installation, Support,
// Upgrades, Maintenance" — the generic service list — and an image model reads "small business +
// installation + maintenance" as a service van. So: a vehicle appears only when the description,
// the industry or the services actually involve one; otherwise the prompt says plainly not to.

const VEHICLE_WORDS =
  /\b(tow|towing|truck|trucks|van|vans|vehicle|vehicles|car|cars|auto|automotive|moving|movers?|delivery|fleet|dealers?(hip)?|mechanic|roadside|haul(ing)?|junk|limo|taxi|rv|boat|trailer|windshield|driveway|parking)\b/i;

/** Does any of the owner's words, the industry or the services call for a vehicle? */
export function wantsVehicles(...texts: Array<string | null | undefined>): boolean {
  return texts.some((t) => !!t && VEHICLE_WORDS.test(String(t)));
}

export const NO_VEHICLES_INSTRUCTION =
  'Do not show any vans, trucks, cars or other vehicles anywhere in the image unless the description above asks for one.';
export const NO_VEHICLES_NEGATIVES = 'vans, trucks, cars, parked vehicles, service vehicles';
