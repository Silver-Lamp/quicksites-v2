'use client';

import { useEffect, useMemo, useState } from 'react';
import { Clock, CalendarDays } from 'lucide-react';
import type { Block } from '@/types/blocks'; // if Block union is elsewhere, keep 'any'
import type { HoursOfOperationContent, HoursPeriod } from '@/admin/lib/zod/blockSchema';

import {
  isOpenNow,
  effectiveWindowsForToday,
  matchExceptionForYMD,
  partsInTz,
  nextOccurrences,
  formatYMDForTz,
  formatRange,              // for weekly table/stack rows
  formatRangeFromMinutes,   // for "Today:" merged windows line
} from '@/lib/hours/utils';

type Props = {
  block?: any; // or your Block type
  className?: string;
  /** Fallback if block has no content: template-level hours */
  templateHours?: HoursOfOperationContent | null;
};

export default function HoursOfOperation({ block, className, templateHours }: Props) {
  // Prefer block.content when present, else fall back to templateHours
  const content = useMemo(() => {
    const c = block?.content && Object.keys(block.content).length > 0
      ? (block.content as HoursOfOperationContent)
      : (templateHours ?? ({} as HoursOfOperationContent));
    return c;
  }, [block?.content, templateHours]);

  // Guard: if content is empty, render nothing
  if (!content || !Array.isArray(content.days)) {
    return null;
  }

  const exToday = useMemo(() => {
    const now = partsInTz(new Date(), content.tz);
    return matchExceptionForYMD(content.exceptions, now.ymd);
  }, [content]);

  const upcoming = useMemo(
    () => nextOccurrences(content.exceptions, content.tz, 3),
    [content]
  );

  const [openNowState, setOpenNowState] = useState(() => isOpenNow(content));
  useEffect(() => {
    const id = setInterval(() => setOpenNowState(isOpenNow(content)), 60_000);
    return () => clearInterval(id);
  }, [content]);

  const { windows: todayWins, hasCarry } = useMemo(
    () => effectiveWindowsForToday(content),
    [content]
  );

  const todayText =
    todayWins.length === 0
      ? 'Closed'
      : todayWins.length === 1 && todayWins[0].start === 0 && todayWins[0].end >= 1440
        ? 'Open 24 hours'
        : todayWins.map(w => formatRangeFromMinutes(w.start, w.end, content.tz)).join(' · ');

  const statusPill =
    content.alwaysOpen && !exToday ? (
      <span className="ml-2 inline-flex items-center rounded-full border px-2 py-0.5 text-xs">Open 24/7</span>
    ) : (
      <span
        className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs border ${
          openNowState ? 'border-green-500 text-green-600' : 'border-rose-400 text-rose-500'
        }`}
      >
        {openNowState ? 'Open now' : 'Closed now'}
      </span>
    );

  return (
    <section className={className}>
      <div className="flex items-center gap-3 mb-1">
        <Clock className="w-5 h-5 opacity-80" />
        <h2 className="text-xl font-semibold">{content.title ?? 'Business Hours'}</h2>
        {statusPill}
        {exToday && (
          <span className="ml-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs">
            <CalendarDays className="w-3 h-3" /> Special hours today{exToday.label ? `: ${exToday.label}` : ''}
          </span>
        )}
      </div>

      {/* Today line (merged windows w/ exceptions + overnight carry) */}
      <div className="mb-3 text-sm opacity-80">
        <span className="font-medium">Today:</span>{' '}
        <span className="tabular-nums">{todayText}</span>
        {!exToday && hasCarry && (
          <span className="ml-2 text-xs inline-flex items-center rounded-full border px-2 py-0.5">
            includes overnight carry
          </span>
        )}
      </div>

      {/* Weekly schedule */}
      {content.display_style === 'stack' ? (
        <div className="space-y-1">
          {content.days.map((d) => (
            <div key={d.key} className="flex items-center justify-between text-sm">
              <span className="font-medium w-14">{d.label}</span>
              {content.alwaysOpen ? (
                <span>Open 24 hours</span>
              ) : d.closed ? (
                <span className="opacity-70">Closed</span>
              ) : (
                <span className="tabular-nums">
                  {d.periods.map((p: HoursPeriod, i: number) => (
                    <span key={i}>
                      {i > 0 && <span className="opacity-50"> · </span>}
                      {formatRange(p, content.tz)}
                    </span>
                  ))}
                </span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <tbody>
              {content.days.map((d, idx) => (
                <tr key={d.key} className={idx % 2 ? 'bg-muted/40' : ''}>
                  <td className="px-4 py-2 font-medium w-24">{d.label}</td>
                  <td className="px-4 py-2">
                    {content.alwaysOpen ? (
                      <span>Open 24 hours</span>
                    ) : d.closed ? (
                      <span className="opacity-70">Closed</span>
                    ) : (
                      <span className="tabular-nums">
                        {d.periods.map((p: HoursPeriod, i: number) => (
                          <span key={i} className="inline-block">
                            {i > 0 && <span className="opacity-50 mx-1">·</span>}
                            {formatRange(p, content.tz)}
                          </span>
                        ))}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!!content.note && <p className="mt-2 text-xs opacity-70">{content.note}</p>}

      {/* Upcoming exceptions */}
      {(() => {
        const items = upcoming;
        if (!items.length) return null;
        return (
          <div className="mt-3 rounded-xl border p-3">
            <div className="flex items-center gap-2 mb-2">
              <CalendarDays className="w-4 h-4" />
              <span className="font-medium text-sm">Upcoming special hours</span>
            </div>
            <ul className="text-sm space-y-1">
              {items.map(({ ex, ymd }) => (
                <li key={`${ex.id}-${ymd}`} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{formatYMDForTz(ymd, content.tz)}</span>
                    {ex.label && <span className="opacity-75">· {ex.label}</span>}
                    {ex.recurring && <span className="text-xs opacity-60">(recurring)</span>}
                  </div>
                  <div className="tabular-nums">
                    {ex.closed ? (
                      <span className="opacity-70">Closed</span>
                    ) : (
                      ex.periods.map((p, i) => (
                        <span key={i} className="inline-block">
                          {i > 0 && <span className="opacity-50 mx-1">·</span>}
                          {formatRange(p, content.tz)}
                        </span>
                      ))
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      })()}
    </section>
  );
}
