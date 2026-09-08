// lib/outreach/addressBackfill.ts
//
// Give a legacy prospect a street to mail to — by NAME, because it has no Google id.
//
// ⚠️ 22 of the first 46 trade drafts could not be mailed, and the reason was misdiagnosed twice.
// The handoff said "Place Details rejects their stored place_ids" and "a fresh sweep fixes it".
// Neither was the mechanism:
//   • Those rows came from the legacy `leads` table (`lib/outreach/migrateLeads.ts`) and carry a
//     SYNTHETIC `place_id = lead:<uuid>`. Details did not reject an expired id; it was never asked
//     about a Google id at all. `backfillMailingAddress` (Details by place_id) can never rescue them.
//   • A re-sweep cannot fix them either: `upsertProspects` is on-conflict-DO-NOTHING on place_id,
//     so a sweep never rewrites an existing row — and when Google returns the same business under
//     its REAL id, the sweep inserts a SECOND prospect and the pipeline builds a SECOND draft site
//     for the same business. That already happened (the 2026-09-07 Arab, AL sweep re-found five).
//
// So this module resolves each one with a Places Text Search on "<name>, <city>, <state>", and then
// refuses to guess: a result is written back only when the name matches, the state matches, the
// address has a street, AND no other prospect already owns the returned place_id. That last check
// is the duplicate detector — when it fires, the right card is the one attached to the real row,
// and the legacy row must stay blocked (and may be dismissed) rather than mailed a second card.
//
// ⚠️ `place_id` is deliberately NEVER rewritten. `migrateLeads` counts `lead:%` rows to stay
// idempotent; swapping one for the real id would let a re-run re-insert that lead as a new
// duplicate. The card only needs an address, so that is all we write (plus coordinates).
//
// Pure functions here; the script in scripts/backfill-prospect-addresses.ts wires DB + Places.
import { parseUsAddress } from '@/lib/outreach/mail/lob';
import type { Prospect } from '@/lib/outreach/prospects';
import type { TextMatch } from '@/lib/places/searchText';

export const LEGACY_PLACE_ID_PREFIX = 'lead:';
export const DEMO_PLACE_ID_PREFIX = 'demo:';

/** A `lead:<uuid>` id minted by the legacy-leads migration — not a Google id. */
export function isLegacyPlaceId(placeId: string | null | undefined): boolean {
  return typeof placeId === 'string' && placeId.startsWith(LEGACY_PLACE_ID_PREFIX);
}

export type BackfillCandidate = Pick<Prospect, 'id' | 'place_id' | 'business_name' | 'address' | 'city' | 'region' | 'status' | 'template_id' | 'address_lat' | 'address_lon'>;

/**
 * Does this row need a name-based lookup? Only when its address will not parse to a street
 * (the same test the mail path applies) and it is a real business, not a demo fixture.
 */
export function needsAddressBackfill(p: BackfillCandidate): boolean {
  if (typeof p.place_id === 'string' && p.place_id.startsWith(DEMO_PLACE_ID_PREFIX)) return false;
  if (!p.business_name?.trim()) return false;
  return !parseUsAddress(p.address, p.city, p.region);
}

const NAME_STOPWORDS = new Set([
  'llc', 'inc', 'co', 'corp', 'ltd', 'the', 'and', 'of', 'a',
  'service', 'services', 'svc', 'svcs', 'company',
]);

// Legacy names use trade abbreviations Google spells out ("Trk & Wrecker Svc").
const NAME_SYNONYMS: Record<string, string> = {
  trk: 'truck', trucks: 'truck', wreckers: 'wrecker', towing: 'tow', tows: 'tow',
  auto: 'automotive', autos: 'automotive', contractors: 'contractor', concretes: 'concrete',
};

/** Lowercase, strip punctuation, drop legal suffixes / filler, fold common trade abbreviations. */
export function nameTokens(name: string | null | undefined): string[] {
  return (name ?? '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((t) => t && !NAME_STOPWORDS.has(t))
    .map((t) => NAME_SYNONYMS[t] ?? t);
}

/**
 * 0..1 overlap of the two names' token sets (Jaccard), with containment counted as a full match:
 * "Ray's Towing" vs "Ray's Towing & Recovery" is the same shop, not a 66% one.
 */
export function nameSimilarity(a: string | null | undefined, b: string | null | undefined): number {
  const ta = new Set(nameTokens(a));
  const tb = new Set(nameTokens(b));
  if (!ta.size || !tb.size) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  if (shared === ta.size || shared === tb.size) return 1;
  return shared / (ta.size + tb.size - shared);
}

export const ACCEPT_NAME_SCORE = 0.5;
/** A near-exact name may sit in a neighbouring town (the legacy city was itself a guess)… */
export const CITY_OVERRIDE_NAME_SCORE = 0.8;
/**
 * …but "neighbouring" is a distance, not a feeling. The first dry run matched "Grant's Towing
 * Service, Grantsville AL" to a Grant's Towing in Fort Mitchell, AL — same state, exact name,
 * ~800 km away (the row's own coordinates were in West Virginia; the legacy data disagreed with
 * itself). A generic trade name recurs in every county, so when the town differs the result must
 * also sit within this radius of the row's stored coordinates. Rows with no coordinates fall back
 * to the name rule alone and are flagged.
 */
export const CITY_OVERRIDE_MAX_KM = 60;

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export type Verdict =
  | { accept: true; address: string; lat: number | null; lon: number | null; nameScore: number; cityDiffers: boolean; distanceKm: number | null; allowed: boolean; parsed: { line1: string; city: string; state: string; zip: string } }
  | { accept: false; reason: 'no_match' | 'no_street' | 'state_differs' | 'name_differs' | 'city_differs' | 'too_far' | 'duplicate_of'; nameScore: number; duplicateOf?: string; detail?: string };

export type AssessOptions = {
  /** Prospect ids an operator has eyeballed: bypasses ONLY the city/distance rules, never a
   *  duplicate, a wrong state, a different name, or a missing street. */
  allow?: Set<string>;
};

/**
 * Decide whether a Text Search result may be written to a prospect. Every rejection names its
 * reason so the operator's table says WHY 9 of 22 stayed blocked, not just that they did.
 */
export function assessAddressCandidate(
  p: BackfillCandidate,
  match: TextMatch | null,
  /** place_id → prospect id for every row already in the table (the duplicate detector). */
  existingPlaceIds: Map<string, string>,
  opts: AssessOptions = {},
): Verdict {
  if (!match) return { accept: false, reason: 'no_match', nameScore: 0 };
  const nameScore = nameSimilarity(p.business_name, match.name);

  // The result belongs to a prospect we already track (typically re-found by a later sweep under
  // its real id). Writing it here would mail two cards for one shop pointing at two draft sites.
  const owner = existingPlaceIds.get(match.placeId);
  if (owner && owner !== p.id) return { accept: false, reason: 'duplicate_of', nameScore, duplicateOf: owner, detail: match.name };

  // Parse WITHOUT hints: a city hint would paper over a result in a different town, and a region
  // hint would supply the very state we are about to check.
  const parsed = parseUsAddress(match.address, null, null);
  if (!parsed) return { accept: false, reason: 'no_street', nameScore, detail: match.address ?? '' };
  if (!/\d/.test(parsed.line1)) return { accept: false, reason: 'no_street', nameScore, detail: match.address ?? '' };

  const region = (p.region ?? '').trim().toUpperCase();
  if (region && parsed.state.toUpperCase() !== region) return { accept: false, reason: 'state_differs', nameScore, detail: parsed.state };
  if (nameScore < ACCEPT_NAME_SCORE) return { accept: false, reason: 'name_differs', nameScore, detail: match.name };

  const cityDiffers = !!p.city && parsed.city.toLowerCase() !== p.city.trim().toLowerCase();
  const hasCoords = typeof p.address_lat === 'number' && typeof p.address_lon === 'number' && typeof match.lat === 'number' && typeof match.lon === 'number';
  const distanceKm = hasCoords ? haversineKm(p.address_lat!, p.address_lon!, match.lat!, match.lon!) : null;
  const allowed = !!opts.allow?.has(p.id);

  if (cityDiffers && !allowed) {
    if (nameScore < CITY_OVERRIDE_NAME_SCORE) return { accept: false, reason: 'city_differs', nameScore, detail: parsed.city };
    if (distanceKm != null && distanceKm > CITY_OVERRIDE_MAX_KM) return { accept: false, reason: 'too_far', nameScore, detail: `${parsed.city}, ${Math.round(distanceKm)} km` };
  }

  return { accept: true, address: match.address!, lat: match.lat, lon: match.lon, nameScore, cityDiffers, distanceKm, allowed, parsed };
}

/** The query we send to Places for a prospect. */
export function backfillQuery(p: BackfillCandidate): string {
  return [p.business_name?.trim(), p.city?.trim(), p.region?.trim()].filter(Boolean).join(', ');
}

export type BackfillRow = {
  prospectId: string;
  businessName: string;
  query: string;
  matchName: string | null;
  verdict: Verdict;
  written: boolean;
  dismissed: boolean;
};

export type BackfillReport = {
  scanned: number;
  needed: number;
  accepted: number;
  written: number;
  dismissed: number;
  rejected: Record<string, number>;
  rows: BackfillRow[];
};

export type BackfillDeps = {
  search: (query: string) => Promise<TextMatch | null>;
  existingPlaceIds: Map<string, string>;
  /** Write address + coordinates to one row. Only called when `apply` is true. */
  writeAddress: (prospectId: string, address: string, lat: number | null, lon: number | null) => Promise<void>;
  /** Mark a legacy duplicate dismissed so it can never be mailed. Only with `dismissDuplicates`. */
  dismiss: (prospectId: string) => Promise<void>;
};

export type BackfillOptions = {
  apply: boolean;
  dismissDuplicates: boolean;
  /** Ids the operator has eyeballed — bypass the city/distance rules only (see AssessOptions). */
  allow?: Set<string>;
  /** Ids to leave alone entirely this run (no search, no write). */
  skip?: Set<string>;
};

/**
 * Orchestrate one pass. Dry by default: nothing is written unless `apply`, and a duplicate is only
 * dismissed when `dismissDuplicates` is ALSO set — dismissal is a status change on a row that has a
 * live draft site behind it, so it is a separate decision from "fix the address".
 */
export async function backfillProspectAddresses(
  prospects: BackfillCandidate[],
  deps: BackfillDeps,
  opts: BackfillOptions,
): Promise<BackfillReport> {
  const report: BackfillReport = { scanned: prospects.length, needed: 0, accepted: 0, written: 0, dismissed: 0, rejected: {}, rows: [] };
  for (const p of prospects) {
    if (!needsAddressBackfill(p)) continue;
    if (opts.skip?.has(p.id)) continue;
    report.needed++;
    const query = backfillQuery(p);
    let match: TextMatch | null = null;
    let searchError: string | null = null;
    try {
      match = await deps.search(query);
    } catch (e: any) {
      searchError = e?.message || 'search_failed';
    }
    const verdict: Verdict = searchError
      ? { accept: false, reason: 'no_match', nameScore: 0, detail: searchError }
      : assessAddressCandidate(p, match, deps.existingPlaceIds, { allow: opts.allow });

    const row: BackfillRow = { prospectId: p.id, businessName: p.business_name, query, matchName: match?.name ?? null, verdict, written: false, dismissed: false };
    if (verdict.accept) {
      report.accepted++;
      if (opts.apply) {
        await deps.writeAddress(p.id, verdict.address, verdict.lat, verdict.lon);
        row.written = true;
        report.written++;
      }
    } else {
      report.rejected[verdict.reason] = (report.rejected[verdict.reason] ?? 0) + 1;
      if (verdict.reason === 'duplicate_of' && opts.apply && opts.dismissDuplicates) {
        await deps.dismiss(p.id);
        row.dismissed = true;
        report.dismissed++;
      }
    }
    report.rows.push(row);
  }
  return report;
}
