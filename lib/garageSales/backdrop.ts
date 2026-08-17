// lib/garageSales/backdrop.ts
//
// The pool namespace for the yardsalesites.com surface (directory, sale pages, create form).
// One constant so all three agree — a directory painted differently from the sale page it links
// to reads as two products.
//
// Resolution and the read-only rule now live in lib/theme/resolvePoolBackdrop.ts, shared with the
// other hand-built pages that carry a backdrop. Worth restating why the rule matters most HERE:
// `/yard-sale/new` is reachable with no account, no sticker and no fee, so generating on the
// render path would be an unbounded ~$0.04/call spend behind an anonymous endpoint — and a ~20s
// wait in front of the visitor. One pool is shared by every sale page; painting per sale would
// scale cost with signups for nothing a shared painting doesn't already give.
//
// ⚠️ `yard-sale` is NOT a `templates.industry` — a garage sale is not a site we build — so the
// pool-fill cron's demand-driven sweep will never reach it on its own. Fill it explicitly:
//
//     POST /api/cron/backdrop-pool-fill?industryKey=yard-sale   (cron-authorized, 2 per call)

/** Storage namespace under `backdrops/pool/`. */
export const YARD_SALE_BACKDROP_KEY = 'yard-sale';
