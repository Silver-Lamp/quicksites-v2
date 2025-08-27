// lib/hours/utils.ts
import type { HoursOfOperationContent, HoursPeriod, DayKey, SpecialHours } from '@/admin/lib/zod/blockSchema';

const DAY_TO_KEY: Record<number, DayKey> = { 0:'sun',1:'mon',2:'tue',3:'wed',4:'thu',5:'fri',6:'sat' };
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export type Win = { start: number; end: number; source: 'today' | 'carry' };

export function isOvernight(p: HoursPeriod) {
  return p.open > p.close; // "HH:mm" lexical works for 24h
}
export function mins(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}
export function formatMinutes(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatRangeFromMinutes(startMin: number, endMin: number, tz?: string, locale?: string) {
  const end = endMin >= 1440 ? 1439 : endMin; // avoid “24:00”
  return formatRange({ open: formatMinutes(startMin), close: formatMinutes(end) }, tz, locale);
}

export function formatRange(period: HoursPeriod, tz?: string, locale?: string) {
  const [oh, om] = period.open.split(':').map(Number);
  const [ch, cm] = period.close.split(':').map(Number);
  const fmt: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: tz };
  const base = new Date();
  const o = new Date(base); o.setHours(oh, om, 0, 0);
  const c = new Date(base); c.setHours(ch, cm, 0, 0);
  return `${new Intl.DateTimeFormat(locale, fmt).format(o)} – ${new Intl.DateTimeFormat(locale, fmt).format(c)}`;
}

export function partsInTz(d: Date, tz?: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d);
  const by = (t: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === t)?.value!;
  const wd = parts.find(p => p.type === 'weekday')?.value ?? 'Sun';
  const map: Record<string, number> = { Sun:0, Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6 };
  const y = Number(by('year'));
  const m = by('month');
  const day = by('day');
  const hour = Number(by('hour'));
  const minute = Number(by('minute'));
  return { dow: map[wd] ?? d.getDay(), minutes: hour * 60 + minute, y, m, d: day, ymd: `${y}-${m}-${day}`, md: `${m}-${day}` };
}

export function matchExceptionForYMD(exceptions: SpecialHours[] | undefined, ymd: string): SpecialHours | undefined {
  if (!exceptions?.length) return undefined;
  const md = ymd.slice(5);
  return exceptions.find(e => !e.recurring && e.date === ymd) ?? exceptions.find(e => e.recurring && e.date.slice(5) === md);
}

function windowsSameDay(periods: HoursPeriod[]): Win[] {
  const w: Win[] = [];
  for (const p of periods) {
    const s = mins(p.open);
    const e = mins(p.close);
    if (isOvernight(p)) {
      w.push({ start: s, end: 1440, source: 'today' }); // evening part
    } else if (s !== e) {
      w.push({ start: s, end: e, source: 'today' });
    }
  }
  return w;
}
function windowsYesterdayCarry(periods: HoursPeriod[]): Win[] {
  const w: Win[] = [];
  for (const p of periods) {
    if (isOvernight(p)) {
      const e = mins(p.close);
      if (e > 0) w.push({ start: 0, end: e, source: 'carry' }); // after midnight
    }
  }
  return w;
}
function mergeWindows(wins: Win[]) {
  if (!wins.length) return { merged: [] as Win[], hasCarry: false };
  const sorted = wins.map(w => ({ ...w })).sort((a, b) => a.start - b.start || a.end - b.end);
  const out: Win[] = [];
  let hasCarry = false;
  for (const w of sorted) {
    hasCarry ||= w.source === 'carry';
    if (!out.length) { out.push(w); continue; }
    const last = out[out.length - 1];
    if (w.start <= last.end) last.end = Math.max(last.end, w.end);
    else out.push(w);
  }
  return { merged: out, hasCarry };
}

export function effectiveWindowsForToday(hours: HoursOfOperationContent) {
  const now = new Date();
  const nowTz = partsInTz(now, hours.tz);
  const yesterdayTz = partsInTz(new Date(now.getTime() - ONE_DAY_MS), hours.tz);

  const exToday = matchExceptionForYMD(hours.exceptions, nowTz.ymd);
  if (exToday) {
    if (exToday.closed || !exToday.periods?.length) return { windows: [] as Win[], hasCarry: false, exToday };
    const { merged } = mergeWindows(windowsSameDay(exToday.periods));
    return { windows: merged, hasCarry: false, exToday };
  }

  if (hours.alwaysOpen) return { windows: [{ start: 0, end: 1440, source: 'today' }], hasCarry: false, exToday: undefined };

  const today = hours.days.find(d => d.key === DAY_TO_KEY[nowTz.dow]);
  const yesterday = hours.days.find(d => d.key === DAY_TO_KEY[yesterdayTz.dow]);

  const parts: Win[] = [];
  if (yesterday && !yesterday.closed) parts.push(...windowsYesterdayCarry(yesterday.periods));
  if (today && !today.closed) parts.push(...windowsSameDay(today.periods));

  const { merged, hasCarry } = mergeWindows(parts);
  return { windows: merged, hasCarry, exToday: undefined };
}

export function isOpenNow(hours: HoursOfOperationContent) {
  const { windows } = effectiveWindowsForToday(hours);
  const now = partsInTz(new Date(), hours.tz).minutes;
  return windows.some(w => now >= w.start && now <= w.end);
}

export function formatTodayText(hours: HoursOfOperationContent) {
  const { windows, hasCarry } = effectiveWindowsForToday(hours);
  const text =
    windows.length === 0
      ? 'Closed'
      : windows.length === 1 && windows[0].start === 0 && windows[0].end >= 1440
        ? 'Open 24 hours'
        : windows.map(w => formatRangeFromMinutes(w.start, w.end, hours.tz)).join(' · ');
  return { text, hasCarry };
}

// Return next N upcoming exception dates (recurring respected)
export function nextOccurrences(
    exceptions: SpecialHours[] | undefined,
    tz: string | undefined,
    take = 3
  ): { ex: SpecialHours; ymd: string }[] {
    if (!exceptions?.length) return [];
    const now = new Date();
    const nowTz = partsInTz(now, tz);
  
    const items = exceptions
      .map((ex) => {
        if (!ex.recurring) {
          // future (or today) only
          if (ex.date >= nowTz.ymd) return { ex, ymd: ex.date };
          return null;
        }
        const md = ex.date.slice(5);
        const year = md >= nowTz.md ? nowTz.y : nowTz.y + 1;
        return { ex, ymd: `${year}-${md}` };
      })
      .filter(Boolean) as { ex: SpecialHours; ymd: string }[];
  
    items.sort((a, b) => (a.ymd < b.ymd ? -1 : a.ymd > b.ymd ? 1 : 0));
    return items.slice(0, take);
  }
  
  // Format "YYYY-MM-DD" as a friendly date in the given tz
  export function formatYMDForTz(ymd: string, tz?: string) {
    const [Y, M, D] = ymd.split('-').map(Number);
    // Noon UTC → avoids DST edge weirdness when formatting in other tzs
    const dt = new Date(Date.UTC(Y, (M - 1), D, 12, 0, 0));
    return new Intl.DateTimeFormat(undefined, {
      timeZone: tz,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(dt);
  }
  
