// lib/ppl/sendWindow.ts — when it makes sense to text a business a pitch. Pure.
//
// Owner, 2026-10-18: "only text on days/hours that make sense for that business". A tradesperson
// reads texts between jobs, not at 7am loading the truck or at 6pm at dinner, and a Saturday
// pitch from a number they know for customer calls reads as noise. So: the business's own clock
// (campaign region → zone), weekdays only, mid-morning and mid-afternoon, Monday afternoons only
// (the morning is the week's backlog). The hourly cron fires at :20, so windows are whole hours.
//
// Not a rule about customer calls — those connect 24/7 — only about OUR texts to the business.
export const REGION_TZ: Record<string, string> = {
  WA: 'America/Los_Angeles', OR: 'America/Los_Angeles', CA: 'America/Los_Angeles', NV: 'America/Los_Angeles',
  ID: 'America/Boise', MT: 'America/Denver', UT: 'America/Denver', CO: 'America/Denver', WY: 'America/Denver', NM: 'America/Denver', AZ: 'America/Phoenix',
  TX: 'America/Chicago', OK: 'America/Chicago', KS: 'America/Chicago', NE: 'America/Chicago', SD: 'America/Chicago', ND: 'America/Chicago', MN: 'America/Chicago', IA: 'America/Chicago', MO: 'America/Chicago', AR: 'America/Chicago', LA: 'America/Chicago', MS: 'America/Chicago', AL: 'America/Chicago', TN: 'America/Chicago', WI: 'America/Chicago', IL: 'America/Chicago',
  IN: 'America/Indiana/Indianapolis', MI: 'America/Detroit', OH: 'America/New_York', KY: 'America/New_York', GA: 'America/New_York', FL: 'America/New_York', SC: 'America/New_York', NC: 'America/New_York', VA: 'America/New_York', WV: 'America/New_York', MD: 'America/New_York', DE: 'America/New_York', PA: 'America/New_York', NJ: 'America/New_York', NY: 'America/New_York', CT: 'America/New_York', RI: 'America/New_York', MA: 'America/New_York', VT: 'America/New_York', NH: 'America/New_York', ME: 'America/New_York', DC: 'America/New_York',
  AK: 'America/Anchorage', HI: 'Pacific/Honolulu',
};
export const DEFAULT_TZ = 'America/Los_Angeles';

export function tzForRegion(region: string | null | undefined): string {
  return REGION_TZ[String(region ?? '').trim().toUpperCase()] ?? DEFAULT_TZ;
}

/** Local hours (24h, start inclusive, end exclusive) in which a pitch text may go, by weekday. */
export type Window = { startHour: number; endHour: number };
const MID_MORNING: Window = { startHour: 10, endHour: 12 };
const MID_AFTERNOON: Window = { startHour: 14, endHour: 16 };

export function windowsFor(weekday: number, industry: string | null | undefined): Window[] {
  // 0 = Sunday … 6 = Saturday
  if (weekday === 0 || weekday === 6) return [];
  if (weekday === 1) return [MID_AFTERNOON]; // Monday morning is the backlog
  void industry; // one rule for every trade today; the parameter is here so a trade can differ later
  return [MID_MORNING, MID_AFTERNOON];
}

export function localParts(nowMs: number, tz: string): { weekday: number; hour: number; minute: number; label: string } {
  const d = new Date(nowMs);
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', hour: 'numeric', minute: '2-digit', hour12: false }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  const hour = Number(get('hour')) % 24;
  const minute = Number(get('minute'));
  return { weekday: wd, hour, minute, label: new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(d) };
}

export type WindowCheck = { ok: true; tz: string; local: string } | { ok: false; tz: string; local: string; reason: 'weekend' | 'outside_hours' };

export function isGoodTimeToText(nowMs: number, args: { region: string | null | undefined; industry?: string | null }): WindowCheck {
  const tz = tzForRegion(args.region);
  const { weekday, hour, label } = localParts(nowMs, tz);
  const windows = windowsFor(weekday, args.industry);
  if (!windows.length) return { ok: false, tz, local: label, reason: 'weekend' };
  const inside = windows.some((w) => hour >= w.startHour && hour < w.endHour);
  return inside ? { ok: true, tz, local: label } : { ok: false, tz, local: label, reason: 'outside_hours' };
}

/** A human sentence for the email: when the next window opens, from now, on that clock. */
export function nextWindowLabel(nowMs: number, args: { region: string | null | undefined; industry?: string | null }): string {
  const tz = tzForRegion(args.region);
  for (let h = 1; h <= 24 * 4; h++) {
    const t = nowMs + h * 3_600_000;
    const c = isGoodTimeToText(t, args);
    if (c.ok) {
      const { weekday, hour } = localParts(t, tz);
      const w = windowsFor(weekday, args.industry).find((x) => hour >= x.startHour && hour < x.endHour)!;
      const day = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long' }).format(new Date(t));
      return `${day} ${w.startHour}:00–${w.endHour}:00 (${tz.split('/').pop()?.replace('_', ' ')})`;
    }
  }
  return 'within the week';
}
