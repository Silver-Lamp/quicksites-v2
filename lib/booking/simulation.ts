// lib/booking/simulation.ts
//
// A SIMULATION site: a restaurant AI personas run for a day (HiveJournal, owner's request
// 2026-10-15 — staff + guest personas using the real system to test it and record a time-lapse).
// Flag: `data.meta.is_simulation === true`. ⚠️ Deliberately SEPARATE from `meta.is_demo`: the demo
// flag exempts the trattoria from the owner-link check, and a simulation must be linked by the
// owner like a real site — a sim never inherits the demo's exemption.
//
// What the flag changes (and nothing else):
//   - no booking emails (personas have @hivejournal.ai addresses; nobody gets "your table is booked"
//     for a fiction) — the booking rows are written exactly as usual;
//   - a partner-signed /book on a sim site that is LINKED skips the per-IP guest limit (a sim day is
//     30–50 web bookings from one server IP); unsigned, non-sim or unlinked calls are unchanged;
//   - excluded from the delivered.menu directory (lib/delivered/listing.ts). The site is published
//     with meta.noindex so a browser persona can use the widget while search never sees it.
export function isSimulationSite(data: unknown): boolean {
  const meta = (data as { meta?: { is_simulation?: unknown } } | null)?.meta;
  return meta?.is_simulation === true;
}
