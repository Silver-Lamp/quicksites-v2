// lib/parks/suiteScheme.ts
//
// Synthetic unit-numbering for an industrial/flex park. Google Places gives us a real
// park building + street, but NEVER its suite/unit ranges — that data isn't in any free
// feed. So we synthesize a plausible scheme per park (stable, derived from its place_id)
// and sample a unit deterministically from a seed (the pitch site's domain), so the same
// site always shows the same suite and it's provably not a real tenant's unit.
//
// Pure module — no I/O. Safe to unit-test.

export type SuiteScheme =
  | { type: 'range'; from: number; to: number }
  | { type: 'building_letter'; buildings: string[]; per: number };

/** Canonical park use tags we infer from a park's name/keywords. */
export type ParkUse = 'flex' | 'warehouse' | 'light_mfg' | 'office';

const ALL_LETTERS = 'ABCDEFGHJ'.split(''); // skip I (reads as 1)

/** Stable non-negative hash of a string (same as suiteFromDomain's mixing). */
function hashStr(s: string): number {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

/**
 * Deterministically pick a suite scheme for a park from its place_id, so a given park
 * always presents the same numbering. Two common real-world shapes: a numeric range
 * (Suite 100–250) or lettered buildings each with N units (Building C, Unit 12).
 */
export function schemeForPark(placeId: string): SuiteScheme {
  const h = hashStr(placeId);
  if (h % 2 === 0) {
    const buildings = ALL_LETTERS.slice(0, 3 + (h % 5)); // A..(C–G)
    return { type: 'building_letter', buildings, per: 8 + (h % 13) }; // 8–20 units/building
  }
  const from = [100, 100, 200, 1000][h % 4];
  const span = 8 + (h % 20); // 8–27 units
  return { type: 'range', from, to: from + span * 5 };
}

/**
 * Sample a concrete unit designator from a scheme, seeded so it's stable per caller
 * (pass the pitch site's domain/template id). Returns e.g. "170" or "C-12".
 */
export function pickSuite(scheme: SuiteScheme, seed: string): string {
  const h = hashStr(seed);
  if (scheme.type === 'building_letter') {
    const b = scheme.buildings[h % scheme.buildings.length] ?? 'A';
    const unit = 1 + (h % Math.max(1, scheme.per));
    return `${b}-${unit}`;
  }
  const from = Math.min(scheme.from, scheme.to);
  const to = Math.max(scheme.from, scheme.to);
  const steps = Math.max(1, Math.floor((to - from) / 5));
  return String(from + (h % (steps + 1)) * 5);
}

const USE_KEYWORDS: Record<ParkUse, RegExp> = {
  warehouse: /\b(warehouse|distribution|logistics|storage|self.?storage)\b/i,
  light_mfg: /\b(industrial|manufactur|fabricat|machine|welding|assembly)\b/i,
  flex: /\b(flex|business park|commerce|commercial park|enterprise|tech park|trade)\b/i,
  office: /\b(office|professional|corporate|executive|suites)\b/i,
};

/**
 * Infer permitted-use tags from a park's name (best-effort). Always returns at least
 * ['flex'] so a park is never un-matchable — most light-industrial trades fit a flex unit.
 */
export function inferParkUses(name: string | null | undefined): ParkUse[] {
  const n = name ?? '';
  const uses = (Object.keys(USE_KEYWORDS) as ParkUse[]).filter((u) => USE_KEYWORDS[u].test(n));
  return uses.length ? uses : ['flex'];
}

// Places surfaces two kinds of non-shop space for industrial queries that we don't want:
// coworking / executive-office providers, and self-storage facilities. Neither is space a
// trade could set up an operating business in, so both are excluded — the registry only
// holds parks where a business could actually rent a warehouse/flex unit.
const NON_SHOP_OPERATOR =
  /\b(regus|wework|coworking|co-working|executive\s+suites?|serviced\s+office|virtual\s+office|creative\s+workspace|office\s+suites?|self[\s-]?storage|public\s+storage|extra\s+space|cubesmart|life\s+storage|storquest|stor-?house|u-?haul)\b/i;

/**
 * Keep only genuine industrial / warehouse / flex-industrial parks — drop coworking &
 * executive-office providers (Regus, WeWork, …) and self-storage facilities (Public
 * Storage, "Self Storage", …). Name-based; the best discriminator a Places result gives us.
 */
export function isIndustrialPark(name: string | null | undefined): boolean {
  return !NON_SHOP_OPERATOR.test(name ?? '');
}
