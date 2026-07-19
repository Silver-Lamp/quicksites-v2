// lib/compare/registry.ts
//
// The compare-cluster REGISTRY + a pure staleness auditor. Powers the quarterly
// compare-registry-audit cron (mirrors HiveJournal's contract, coordinated via crosstalk):
// it NEVER re-fetches competitor pricing (auto-scraping is fragile and would ship a wrong
// price, torching the honesty-first trust the whole cluster is built on) — it only FLAGS
// entries a human should re-verify, by filing an admin_task.
//
// One entry per product-vs-competitor-set. `pricesVerified` is an ISO date that mirrors the
// cluster lib's PRICES_VERIFIED display stamp (lib/compare/competitors.ts) — bump BOTH when
// you re-verify. Field shape kept aligned with HJ's COMPARE_REGISTRY so a future shared
// refresh stays easy.

import { COMPETITOR_SLUGS } from '@/lib/compare/competitors';

export type CompareRegistryStatus = 'live' | 'candidate' | 'skip';

export interface CompareRegistryEntry {
  key: string; // stable id, e.g. 'website-builders'
  name: string; // human name, e.g. 'QuickSites vs website builders'
  status: CompareRegistryStatus;
  clusterPath: string; // e.g. '/compare'
  libFile: string; // where the data lives (for the human who refreshes)
  competitors: string[]; // competitor slugs in the cluster
  pricesVerified: string; // ISO date; mirrors the lib's PRICES_VERIFIED — bump both on refresh
  notes?: string;
}

export const COMPARE_REGISTRY: CompareRegistryEntry[] = [
  {
    key: 'website-builders',
    name: 'QuickSites vs website builders',
    status: 'live',
    clusterPath: '/compare',
    libFile: 'lib/compare/competitors.ts',
    competitors: COMPETITOR_SLUGS,
    pricesVerified: '2026-07-01', // mirrors PRICES_VERIFIED = 'July 2026'
    notes: 'Wix, Squarespace, GoDaddy, Webflow, Shopify, Duda, GoHighLevel',
  },
  // Add CANDIDATE entries (a product/set worth comparing but with no cluster yet) to have the
  // audit file a "Build compare cluster: X" task. None today.
];

export type CompareAuditFinding =
  | { kind: 'stale'; key: string; name: string; clusterPath: string; libFile: string; ageDays: number; pricesVerified: string }
  | { kind: 'gap'; key: string; name: string; notes?: string };

/**
 * PURE staleness/gap audit — no I/O, `nowMs` injected so it's deterministic + unit-testable.
 * - `live` cluster with `pricesVerified` older than `staleDays` (or unparseable) → 'stale'.
 * - `candidate` with no cluster → 'gap'.
 * - `skip` → ignored.
 */
export function auditCompareRegistry(
  registry: CompareRegistryEntry[],
  nowMs: number,
  staleDays = 90,
): CompareAuditFinding[] {
  const out: CompareAuditFinding[] = [];
  for (const e of registry) {
    if (e.status === 'skip') continue;
    if (e.status === 'candidate') {
      out.push({ kind: 'gap', key: e.key, name: e.name, notes: e.notes });
      continue;
    }
    // live → staleness check
    const t = Date.parse(e.pricesVerified);
    const ageDays = Number.isFinite(t) ? Math.floor((nowMs - t) / 86_400_000) : Infinity;
    if (ageDays >= staleDays) {
      out.push({
        kind: 'stale',
        key: e.key,
        name: e.name,
        clusterPath: e.clusterPath,
        libFile: e.libFile,
        ageDays,
        pricesVerified: e.pricesVerified,
      });
    }
  }
  return out;
}
