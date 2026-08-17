// lib/garageSales/backdrop.ts
//
// The backdrop for the yardsalesites.com surface (the directory, the sale pages, the create
// form). One resolver so all three agree — a directory painted differently from the sale page
// it links to reads as two products.
//
// ⚠️ PAINTERLY IS READ HERE, NEVER GENERATED HERE. Rule 2 of the mesh painterly-backdrop
// standard (crosstalk/contracts/painterly-backdrop.md) is that generation is owner/admin
// triggered, never per-request — and this surface is the one place that rule matters most,
// because `/yard-sale/new` is reachable by anyone with no account and no fee. Putting a
// ~$0.04 gpt-image-1 call on that path would be an unbounded spend behind an anonymous
// endpoint. So this module only ever READS a pool that some admin/cron already filled:
//
//     npx tsx -e "..." or  POST /api/cron/backdrop-pool-fill?industryKey=yard-sale
//
// The pool is capped at POOL_TARGET (25 ≈ $1 for the whole surface, once) and shared by every
// sale page, which is the entire cost-safety argument. Sales are free and ephemeral; painting
// one image per sale would scale spend with signups for no gain a shared painting doesn't give.
//
// DEGRADES, NEVER BREAKS. Pool off, pool empty, storage down → `paper`, a pure-CSS backdrop
// built from the surface's own theme vars. Free, first-paint, and correct in light or dark.
// The failure mode of the expensive layer is the cheap layer, not a flat page and not an error.
import { pickPoolBackdrop } from '@/lib/theme/backdropPool';
import type { SiteBackdrop } from '@/lib/theme/backdrops';

/** Pool namespace for this surface. Not an `industry` on `templates` — a garage sale is not a
 *  site we build — so the pool-fill cron's demand-driven sweep will never pick it up on its
 *  own. Fill it explicitly with `?industryKey=yard-sale`. */
export const YARD_SALE_BACKDROP_KEY = 'yard-sale';

/** Warm tonal paper. Chosen over `wash`/`mesh` because a yard sale is a hand-lettered,
 *  cardboard-sign occasion, not a SaaS landing page. */
const CSS_FALLBACK: SiteBackdrop = { style: 'paper', intensity: 55 };

type Cached = { at: number; value: SiteBackdrop };
let cached: Cached | null = null;

/** Storage `list()` costs a network round trip and these pages are `force-dynamic`, so without
 *  this every request would pay for it. Per-instance and short — a pool fill shows up within
 *  the TTL rather than needing a deploy. */
const TTL_MS = 5 * 60 * 1000;

/** The backdrop every yardsalesites.com surface renders. Never throws, never null. */
export async function resolveYardSaleBackdrop(now = Date.now()): Promise<SiteBackdrop> {
  if (cached && now - cached.at < TTL_MS) return cached.value;

  let value: SiteBackdrop = CSS_FALLBACK;
  try {
    const url = await pickPoolBackdrop(YARD_SALE_BACKDROP_KEY);
    // `intensity` feeds the painterly opacity ramp (0.10 + 0.35·t). Held back deliberately:
    // the page has to stay readable whatever the model returned, which is why a scrim goes
    // over it too — standard rule 8, enforce contrast rather than hope for it.
    if (url) value = { style: 'painterly', url, intensity: 50 };
  } catch {
    // Swallowed on purpose: a storage hiccup must not take down a public page over decoration.
    value = CSS_FALLBACK;
  }

  cached = { at: now, value };
  return value;
}

/** Test seam — the module-level cache would otherwise leak between cases. */
export function __resetYardSaleBackdropCache() {
  cached = null;
}
