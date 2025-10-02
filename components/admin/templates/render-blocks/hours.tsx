'use client';

import { useEffect, useMemo, useState } from 'react';
import { Clock, CalendarDays } from 'lucide-react';
import type { HoursOfOperationContent, HoursPeriod } from '@/admin/lib/zod/blockSchema';

import {
  isOpenNow,
  effectiveWindowsForToday,
  matchExceptionForYMD,
  partsInTz,
  nextOccurrences,
  formatYMDForTz,
  formatRange,
  formatRangeFromMinutes,
} from '@/lib/hours/utils';

type Props = {
  block?: any;
  className?: string;
  templateHours?: HoursOfOperationContent | null;
  /** Force light/dark for this block only (overrides template) */
  colorMode?: 'light' | 'dark';
  template?: any;
};

export default function HoursOfOperation({
  block,
  className,
  templateHours,
  colorMode,
  template,
}: Props) {
  const content = useMemo(() => {
    const c =
      block?.content && Object.keys(block.content).length > 0
        ? (block.content as HoursOfOperationContent)
        : (templateHours ?? ({} as HoursOfOperationContent));
    return c;
  }, [block?.content, templateHours]);

  if (!content || !Array.isArray(content.days)) return null;

  /* ---------- Theme / color mode (match ServicesRender) ---------- */
  const effectiveMode: 'light' | 'dark' =
    colorMode ?? (template?.color_mode === 'dark' ? 'dark' : 'light');

  const exToday = useMemo(() => {
    const now = partsInTz(new Date(), content.tz);
    return matchExceptionForYMD(content.exceptions, now.ymd);
  }, [content]);

  const upcoming = useMemo(() => nextOccurrences(content.exceptions, content.tz, 3), [content]);

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
        : todayWins.map((w) => formatRangeFromMinutes(w.start, w.end, content.tz)).join(' · ');

  /* ---------- Per-theme classes ---------- */
  const shellCls =
    effectiveMode === 'light'
      ? 'bg-white text-black border border-neutral-200'
      : 'bg-neutral-950 text-white border border-white/10';

  const iconCls = effectiveMode === 'light' ? 'text-neutral-700' : 'text-neutral-300';
  const labelCls = effectiveMode === 'light' ? 'text-neutral-900' : 'text-white';
  const subTextCls = effectiveMode === 'light' ? 'text-neutral-700' : 'text-neutral-300';
  const zebraRow = effectiveMode === 'light' ? 'bg-neutral-100/70' : 'bg-neutral-900/50';
  const tableBorder = effectiveMode === 'light' ? 'border-neutral-200' : 'border-white/10';
  const pillBorder = effectiveMode === 'light' ? 'border-neutral-300' : 'border-white/20';
  const noteCls = effectiveMode === 'light' ? 'text-neutral-600' : 'text-neutral-300';

  const statusPill =
    content.alwaysOpen && !exToday ? (
      <span className={`ml-2 inline-flex items-center rounded-full border ${pillBorder} px-2 py-0.5 text-xs ${subTextCls}`}>
        Open 24/7
      </span>
    ) : (
      <span
        className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs border ${
          openNowState ? 'border-green-500 text-green-500' : 'border-rose-400 text-rose-400'
        }`}
      >
        {openNowState ? 'Open now' : 'Closed now'}
      </span>
    );

  return (
    <section className={`rounded-2xl ${shellCls} ${className ?? ''}`}>
      <div className="p-6">
        <div className="mb-1 flex items-center gap-3">
          <Clock className={`h-5 w-5 ${iconCls}`} />
          <h2 className={`text-xl font-semibold ${labelCls}`}>{content.title ?? 'Business Hours'}</h2>
          {statusPill}
          {exToday && (
            <span className={`ml-2 inline-flex items-center gap-1 rounded-full border ${pillBorder} px-2 py-0.5 text-xs ${subTextCls}`}>
              <CalendarDays className="h-3 w-3" /> Special hours today{exToday.label ? `: ${exToday.label}` : ''}
            </span>
          )}
        </div>

        {/* Today line */}
        <div className={`mb-4 text-sm ${subTextCls}`}>
          <span className={`font-medium ${labelCls}`}>Today:</span>{' '}
          <span className="tabular-nums">{todayText}</span>
          {!exToday && hasCarry && (
            <span className={`ml-2 inline-flex items-center rounded-full border ${pillBorder} px-2 py-0.5 text-xs ${subTextCls}`}>
              includes overnight carry
            </span>
          )}
        </div>

        {/* Weekly schedule */}
        {content.display_style === 'stack' ? (
          <div className="space-y-2">
            {content.days.map((d) => (
              <div key={d.key} className="flex items-center justify-between text-sm">
                <span className={`w-16 font-medium ${labelCls}`}>{d.label}</span>
                {content.alwaysOpen ? (
                  <span className={subTextCls}>Open 24 hours</span>
                ) : d.closed ? (
                  <span className={subTextCls.replace('700', '500')}>Closed</span>
                ) : (
                  <span className={`tabular-nums ${subTextCls}`}>
                    {d.periods.map((p: HoursPeriod, i: number) => (
                      <span key={i}>
                        {i > 0 && <span className="mx-1 opacity-50">·</span>}
                        {formatRange(p, content.tz)}
                      </span>
                    ))}
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className={`overflow-hidden rounded-xl border ${tableBorder}`}>
            <table className="w-full text-sm">
              <tbody>
                {content.days.map((d, idx) => (
                  <tr key={d.key} className={idx % 2 ? zebraRow : ''}>
                    <td className={`w-28 px-4 py-3 font-medium ${labelCls}`}>{d.label}</td>
                    <td className="px-4 py-3">
                      {content.alwaysOpen ? (
                        <span className={subTextCls}>Open 24 hours</span>
                      ) : d.closed ? (
                        <span className={subTextCls.replace('700', '500')}>Closed</span>
                      ) : (
                        <span className={`tabular-nums ${subTextCls}`}>
                          {d.periods.map((p: HoursPeriod, i: number) => (
                            <span key={i} className="inline-block">
                              {i > 0 && <span className="mx-1 opacity-50">·</span>}
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

        {!!content.note && <p className={`mt-3 text-xs ${noteCls}`}>{content.note}</p>}

        {/* Upcoming exceptions */}
        {(() => {
          const items = upcoming;
          if (!items.length) return null;
          return (
            <div className={`mt-4 rounded-xl border ${tableBorder} p-3`}>
              <div className="mb-2 flex items-center gap-2">
                <CalendarDays className={`h-4 w-4 ${iconCls}`} />
                <span className={`text-sm font-medium ${labelCls}`}>Upcoming special hours</span>
              </div>
              <ul className="space-y-1 text-sm">
                {items.map(({ ex, ymd }) => (
                  <li key={`${ex.id}-${ymd}`} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${labelCls}`}>{formatYMDForTz(ymd, content.tz)}</span>
                      {ex.label && <span className={subTextCls}>· {ex.label}</span>}
                      {ex.recurring && <span className={`text-xs ${subTextCls.replace('700', '500')}`}>(recurring)</span>}
                    </div>
                    <div className="tabular-nums">
                      {ex.closed ? (
                        <span className={subTextCls.replace('700', '500')}>Closed</span>
                      ) : (
                        ex.periods.map((p, i) => (
                          <span key={i} className={`inline-block ${subTextCls}`}>
                            {i > 0 && <span className="mx-1 opacity-50">·</span>}
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
      </div>
    </section>
  );
}
