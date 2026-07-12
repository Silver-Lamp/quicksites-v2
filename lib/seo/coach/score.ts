// lib/seo/coach/score.ts
//
// Deterministic 0–100 SEO health score from a site's signals. Pure. The score is a
// coaching heuristic (weighted rubric), not a ranking guarantee — its job is to move
// sensibly as an owner fixes the things the recommendations flag, and to give the
// weekly email a trend number. See docs/AI_SEO_COACHING.md.

import type { SiteSeoSignals, SeoScore } from '@/lib/seo/coach/types';

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/**
 * Weights sum to 100. GSC-derived components (connected/position/CTR) contribute
 * their full weight only when a property is connected; when it isn't, they score as
 * "opportunity" (partial) rather than a hard zero, so a brand-new unconnected site
 * isn't unfairly punished — the recommendations surface "connect GSC" as the fix.
 */
export function computeSeoScore(s: SiteSeoSignals): SeoScore {
  const b: Record<string, number> = {};
  const op = s.onPage;

  // Meta quality — 25
  let meta = 0;
  if (op.hasTitle) meta += 8;
  if (op.titleLen >= 30 && op.titleLen <= 60) meta += 5;
  if (op.hasDescription) meta += 8;
  if (op.descLen >= 70 && op.descLen <= 160) meta += 4;
  b.meta = clamp(meta, 0, 25);

  // Structured data — 10
  b.schema = op.hasSchema ? 10 : 0;

  // Content depth — 20 (word count + more than a single page + an H1)
  let content = 0;
  content += clamp(Math.round((op.wordCount / 400) * 12), 0, 12);
  if (op.pageCount > 1) content += 5;
  if (op.hasH1) content += 3;
  b.content = clamp(content, 0, 20);

  // Search Console connectivity — 15
  b.connectivity = s.gscConnected ? 15 : 4; // partial credit; "connect GSC" is a rec

  // Organic position — 15 (only meaningful with GSC data)
  let organic = 0;
  if (s.gscConnected && s.gsc && s.gsc.impressions > 0) {
    const pos = s.gsc.position || 100;
    if (pos <= 3) organic = 15;
    else if (pos <= 10) organic = 12;
    else if (pos <= 20) organic = 7;
    else organic = 3;
  } else {
    organic = 5; // unknown → neutral-ish opportunity
  }
  b.organic = clamp(organic, 0, 15);

  // Click-through health — 15
  let perf = 0;
  if (s.gscConnected && s.gsc && s.gsc.impressions >= 50) {
    const ctr = s.gsc.ctr ?? 0;
    if (ctr >= 0.05) perf = 15;
    else if (ctr >= 0.02) perf = 10;
    else if (ctr >= 0.01) perf = 6;
    else perf = 2;
  } else {
    perf = 7; // not enough data → neutral
  }
  b.performance = clamp(perf, 0, 15);

  const score = clamp(
    Math.round(b.meta + b.schema + b.content + b.connectivity + b.organic + b.performance),
    0,
    100,
  );
  return { score, breakdown: b };
}
