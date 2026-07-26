// lib/theme/backdropPool.ts
//
// A lazily-filled, per-industry POOL of painterly backdrops.
//
// The idea: instead of paying per site (unbounded) or hand-painting one at a time, each
// industry accumulates up to POOL_TARGET reusable paintings. A new site picks one at
// random — instantly, for free. While a pool is still filling, creation falls back to the
// CSS backdrop, so a visitor NEVER waits on image generation.
//
// Cost is bounded and one-time: POOL_TARGET × ~$0.04 per industry, and nothing after that.
//
// ── Two deliberate design choices, both load-bearing ────────────────────────────────────
//
// 1. **Filling never blocks site creation.** gpt-image-1 measures ~20s at 'medium'. Making
//    a guest wait that long to see their site would be a worse regression than the flat
//    background this feature exists to fix. So creation only ever *reads* the pool; filling
//    happens out-of-band via the cron. Creation with an empty pool = today's CSS backdrop.
//
// 2. **Flag-gated OFF by default** (`BACKDROP_POOL_ENABLED`). Turning it on is a spend
//    decision, and it is a DECLARED divergence from painterly-backdrop rule 2
//    ("owner/admin-triggered, not per-request"): pool fills are triggered by demand rather
//    than by an admin clicking paint. What makes that acceptable rather than a loophole is
//    the hard cap — an industry can never generate more than POOL_TARGET images total, so
//    the worst case is bounded and knowable in advance rather than scaling with traffic
//    (which matters because guest-build lets anonymous visitors create sites).
//
// The pool needs no table: Supabase Storage is the registry. Deterministic paths mean
// listing a prefix gives the count and the members.

import { supabaseAdmin } from '@/lib/supabase/admin';
import { paintPoolImage } from '@/lib/images/paintBackdrop';

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'templates';

/** Images per industry. 25 × ~$0.04 ≈ $1.00 per industry, one-time. */
export const POOL_TARGET = Number(process.env.BACKDROP_POOL_TARGET || 25);

/** Master switch. OFF means: pools are never filled and never read; CSS backdrops only. */
export function backdropPoolEnabled(): boolean {
  const v = process.env.BACKDROP_POOL_ENABLED;
  return v === '1' || v === 'true';
}

export function poolPrefix(industryKey: string): string {
  return `backdrops/pool/${industryKey.replace(/[^a-z0-9_-]/gi, '')}`;
}

/** Public URLs currently in an industry's pool. Empty on any error — never throws. */
export async function listPool(industryKey: string): Promise<string[]> {
  try {
    const prefix = poolPrefix(industryKey);
    const { data, error } = await supabaseAdmin.storage.from(BUCKET).list(prefix, { limit: 100 });
    if (error || !data) return [];
    return data
      .filter((f) => f.name.endsWith('.png'))
      .map((f) => supabaseAdmin.storage.from(BUCKET).getPublicUrl(`${prefix}/${f.name}`).data?.publicUrl)
      .filter((u): u is string => !!u);
  } catch {
    return [];
  }
}

/**
 * Pick a random pool backdrop for a new site, or null to fall back to CSS.
 *
 * Returns null when the flag is off or the pool is empty — the caller then uses the CSS
 * default, which is why an unfilled pool degrades silently instead of blocking.
 *
 * NOTE: random selection is intentional and does NOT need to avoid repeats. Two sites in
 * the same industry sharing a backdrop is acceptable; they differ by accent, fonts, copy
 * and layout. Guaranteeing uniqueness would mean either tracking assignments or generating
 * per site — the exact unbounded cost this pool exists to avoid.
 */
export async function pickPoolBackdrop(industryKey?: string | null): Promise<string | null> {
  if (!backdropPoolEnabled() || !industryKey) return null;
  const urls = await listPool(industryKey);
  if (!urls.length) return null;
  return urls[Math.floor(Math.random() * urls.length)] ?? null;
}

export type PoolFillResult = {
  industryKey: string;
  before: number;
  added: number;
  full: boolean;
  reason?: string;
};

/**
 * Top an industry's pool up by at most `max` images. Called by the cron, never by a
 * request path. Stops at POOL_TARGET — the cap is the whole cost-safety argument.
 */
export async function fillPool(industryKey: string, max = 1, actorId: string | null = null): Promise<PoolFillResult> {
  if (!backdropPoolEnabled()) {
    return { industryKey, before: 0, added: 0, full: false, reason: 'disabled' };
  }

  const existing = await listPool(industryKey);
  const before = existing.length;
  if (before >= POOL_TARGET) {
    return { industryKey, before, added: 0, full: true, reason: 'already_full' };
  }

  const room = POOL_TARGET - before;
  const want = Math.max(0, Math.min(max, room));
  let added = 0;

  for (let i = 0; i < want; i++) {
    // Index by current count so paths stay deterministic and a partial run resumes cleanly.
    const idx = before + added;
    const path = `${poolPrefix(industryKey)}/${String(idx).padStart(3, '0')}.png`;
    const ok = await paintPoolImage(industryKey, path, actorId);
    if (!ok) break; // stop on first failure rather than burning budget retrying
    added++;
  }

  return { industryKey, before, added, full: before + added >= POOL_TARGET };
}
