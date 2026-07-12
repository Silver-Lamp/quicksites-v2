// lib/outreach/rankTrend.ts
//
// Pure rank-trend calc from two GSC snapshots. Position is "lower is better", so an
// improvement is a POSITIVE positionDelta (prev − current). Feeds the trend rules in
// recommendations.ts. See docs/GEO_RECOMMENDATIONS_PLAN.md.

export type RankSnapshot = {
  position: number | null;
  impressions: number | null;
  clicks: number | null;
  ctr: number | null;
};

export type RankTrend = {
  positionDelta: number | null; // prev.position − current.position; >0 = moved up
  impressionsDelta: number | null; // current − prev
  ctr: number | null; // current CTR (0–1)
  position: number | null; // current position
  impressions: number | null; // current impressions
  direction: 'up' | 'down' | 'flat';
};

const num = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null);

/** Compare the current snapshot to the previous one (null when there's no prior). */
export function computeRankTrend(prev: RankSnapshot | null, cur: RankSnapshot): RankTrend {
  const curPos = num(cur.position);
  const prevPos = prev ? num(prev.position) : null;
  const curImp = num(cur.impressions);
  const prevImp = prev ? num(prev.impressions) : null;

  // Only treat a position as "ranked" when it's > 0 (0 = not ranking / unknown).
  const positionDelta =
    prevPos && prevPos > 0 && curPos && curPos > 0 ? Math.round((prevPos - curPos) * 10) / 10 : null;
  const impressionsDelta = curImp != null && prevImp != null ? curImp - prevImp : null;

  let direction: RankTrend['direction'] = 'flat';
  if (positionDelta != null) {
    if (positionDelta >= 1) direction = 'up';
    else if (positionDelta <= -1) direction = 'down';
  }

  return {
    positionDelta,
    impressionsDelta,
    ctr: num(cur.ctr),
    position: curPos,
    impressions: curImp,
    direction,
  };
}
