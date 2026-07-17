'use client';

// components/admin/templates/render-blocks/route-optimizer.tsx
//
// Route Optimizer — orders a list of coord-carrying stops nearest-first from a start
// point (PorchHearth's borrowed nearest-neighbor + Haversine seam; crosstalk ideas.md §19).
// Client-side, $0, no vendor. The headline use is a store-mapper's "plan my day" across
// several AisleAsk cataloging stops.
//
// HONEST LABEL (contract-agreed): straight-line miles, greedy order — NOT driving
// directions. We show that caveat inline so nobody mistakes it for a turn-by-turn route.

import * as React from 'react';
import type { Block } from '@/types/blocks';
import { optimizeRoute, totalStraightLineMiles, type LatLng } from '@/lib/route/optimizeRoute';

type Stop = { label?: string; latitude?: number; longitude?: number };
type Props = { block?: Block; content?: Block['content'] };

const s = (v: any) => (typeof v === 'string' ? v.trim() : '');
const coord = (v: any): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};
const hasCoords = (x: any): x is Required<LatLng> => coord(x?.latitude) != null && coord(x?.longitude) != null;

export default function RenderRouteOptimizer({ block, content }: Props) {
  const c: any = content ?? block?.content ?? {};
  const title = s(c.title) || 'Plan your route';
  const roundTrip = c.round_trip === true;

  const start = c.start ?? {};
  const startLat = coord(start.latitude);
  const startLon = coord(start.longitude);
  const startLabel = s(start.label) || 'Start';

  const validStops: Required<Stop>[] = (Array.isArray(c.stops) ? c.stops : [])
    .filter(hasCoords)
    .map((st: any) => ({ label: s(st.label) || 'Stop', latitude: coord(st.latitude)!, longitude: coord(st.longitude)! }));

  const { ordered, miles } = React.useMemo(() => {
    if (startLat == null || startLon == null || validStops.length === 0) return { ordered: [] as Required<Stop>[], miles: 0 };
    let route = optimizeRoute(startLat, startLon, validStops);
    if (roundTrip) route = [...route, { label: startLabel, latitude: startLat, longitude: startLon }];
    return { ordered: route, miles: totalStraightLineMiles(startLat, startLon, route) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startLat, startLon, roundTrip, JSON.stringify(validStops)]);

  // Need a start with coords and at least one located stop, else render nothing.
  if (startLat == null || startLon == null || ordered.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-xl px-4 py-8">
      <div className="rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-bold tracking-tight">{title}</h2>
          <span className="shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">
            ≈ {miles.toFixed(1)} mi
          </span>
        </div>

        <ol className="mt-4 space-y-2">
          <li className="flex items-center gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold" aria-hidden>◎</span>
            <span className="text-sm font-medium">{startLabel}</span>
          </li>
          {ordered.map((st, i) => {
            const isReturn = roundTrip && i === ordered.length - 1;
            return (
              <li key={i} className="flex items-center gap-3">
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${isReturn ? 'bg-muted' : 'bg-primary text-primary-foreground'}`}>
                  {isReturn ? '◎' : i + 1}
                </span>
                <span className="text-sm">{st.label}</span>
              </li>
            );
          })}
        </ol>

        <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
          Straight-line estimate, nearest-stop order — not driving directions. Distance is as-the-crow-flies.
        </p>
      </div>
    </section>
  );
}
