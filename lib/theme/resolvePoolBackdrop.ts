// lib/theme/resolvePoolBackdrop.ts
//
// Resolve ONE backdrop for a hand-built page from a shared painterly pool, with a free CSS
// fallback. The generic form of what lib/garageSales/backdrop.ts did for one surface.
//
// ⚠️ READS A POOL, NEVER GENERATES. Rule 2 of crosstalk/contracts/painterly-backdrop.md: image
// generation is owner/admin triggered, never per-request. These are PUBLIC pages, several of them
// reachable with no account, so a ~$0.04 gpt-image-1 call on the render path would be unbounded
// spend behind an anonymous endpoint — and would put a ~20s wait in front of a visitor. Filling is
// the `backdrop-pool-fill` cron's job and only ever the cron's job.
//
// DEGRADES, NEVER BREAKS. Flag off, pool empty, storage down → the CSS fallback, which is built
// from the page's own theme vars and costs nothing. The failure mode of the expensive layer is the
// cheap layer, never a flat page and never an error.
import { pickPoolBackdrop } from '@/lib/theme/backdropPool';
import type { BackdropStyle, SiteBackdrop } from '@/lib/theme/backdrops';

export type PoolBackdropOptions = {
  /** Storage namespace under `backdrops/pool/`. For a marketing page this is usually the
   *  matching `templates.industry` key, so the page shares the pool the cron already fills. */
  poolKey: string;
  /** Rendered when no pooled image is available. Pure CSS, free, theme-derived. */
  fallback?: BackdropStyle;
  /** 0–100. Feeds the painterly opacity ramp (0.10 + 0.35·t) and the CSS alphas. */
  intensity?: number;
};

type Cached = { at: number; value: SiteBackdrop };
const cache = new Map<string, Cached>();

/** Storage `list()` is a network round trip and these pages are dynamic, so without this every
 *  request would pay it. Short, so a pool fill shows up without a deploy. */
const TTL_MS = 5 * 60 * 1000;

/** Never throws, never null — the caller always has something renderable. */
export async function resolvePoolBackdrop(
  { poolKey, fallback = 'wash', intensity = 50 }: PoolBackdropOptions,
  now = Date.now(),
): Promise<SiteBackdrop> {
  const hit = cache.get(poolKey);
  if (hit && now - hit.at < TTL_MS) return hit.value;

  let value: SiteBackdrop = { style: fallback, intensity };
  try {
    const url = await pickPoolBackdrop(poolKey);
    if (url) value = { style: 'painterly', url, intensity };
  } catch {
    // Swallowed deliberately: a storage hiccup must not take a public page down over decoration.
  }

  cache.set(poolKey, { at: now, value });
  return value;
}

/** Test seam — the module-level cache would otherwise leak between cases. */
export function __resetPoolBackdropCache() {
  cache.clear();
}
