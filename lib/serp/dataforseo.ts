// lib/serp/dataforseo.ts
//
// The one SERP provider. DataForSEO's `serp/google/organic/live/advanced` returns the page as an
// ordered list of typed items — `paid`, `local_pack`, `ai_overview`, `organic`, … — with a
// `rank_absolute` across all of them, which is exactly the measurement the worksheet asks for.
//
// We deliberately do NOT browse Google ourselves, and must not: automated querying of Google is
// against its terms, and routing it through HiveJournal's personas would be evasion of that rather
// than compliance (same line this mesh already drew on the r/smallbusiness AutoMod filter). A
// vendor whose business is that compliance costs a fraction of a cent per page. The personas earn
// their keep on the NEXT question — "is the page currently winning any good?" — which is a public
// non-Google page and squarely inside crosstalk/contracts/persona-testing.md.
//
// Credentials are the same pair lib/prospects/keywordVolume.ts already uses. Unconfigured is a
// first-class state: `configured()` is false and callers say so, rather than a run that looks
// empty. ⚠️ Every call COSTS MONEY, so nothing here runs on a page render or a user request.

import type { SerpElement, SerpProvider, SerpSnapshot } from '@/lib/serp/types';
import { BLOCKING_KINDS } from '@/lib/serp/types';

const ENDPOINT = 'https://api.dataforseo.com/v3/serp/google/organic/live/advanced';

/** DataForSEO item_type → our kind. Anything unlisted still counts as a block, as `other`. */
const KIND_MAP: Record<string, SerpElement['kind']> = {
  organic: 'organic',
  paid: 'paid',
  local_pack: 'local_pack',
  ai_overview: 'ai_overview',
  people_also_ask: 'people_also_ask',
  shopping: 'shopping',
  images: 'images',
  video: 'video',
  featured_snippet: 'featured_snippet',
  knowledge_graph: 'knowledge_graph',
  top_stories: 'top_stories',
  twitter: 'twitter',
  map: 'local_pack',
  local_services: 'paid',
  commercial_units: 'shopping',
};

export function serpConfigured(): boolean {
  return !!(process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD);
}

function hostOf(url: unknown): string | undefined {
  if (typeof url !== 'string' || !url) return undefined;
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return undefined;
  }
}

type RawItem = {
  type?: unknown;
  rank_absolute?: unknown;
  domain?: unknown;
  url?: unknown;
  items?: unknown[];
};

/** Map one task result's items into our elements. Exported for testing without a network call. */
export function mapItems(items: readonly RawItem[]): SerpElement[] {
  const out: SerpElement[] = [];
  for (const it of items) {
    const type = typeof it?.type === 'string' ? it.type : '';
    const rank = typeof it?.rank_absolute === 'number' ? it.rank_absolute : NaN;
    if (!type || !Number.isFinite(rank)) continue;
    const kind = KIND_MAP[type] ?? ((BLOCKING_KINDS as readonly string[]).includes(type) ? (type as SerpElement['kind']) : 'other');
    const el: SerpElement = { kind, rank };
    if (kind === 'organic') {
      el.domain = (typeof it.domain === 'string' ? it.domain.toLowerCase().replace(/^www\./, '') : undefined) ?? hostOf(it.url);
    }
    if (kind === 'local_pack' && Array.isArray(it.items)) {
      el.entries = it.items.length;
    }
    out.push(el);
  }
  return out;
}

/**
 * ⚠️ A local_pack arrives EITHER as one block with nested `items`, OR as several sibling
 * `local_pack` items with consecutive ranks — the shape varies by query. Collapsing the second
 * form matters: three siblings left uncollapsed read as three separate blocks above organic AND
 * as a pack of size 1, which would flip a "skip" into a "best case". Both halves of the verdict
 * would be wrong, in the direction that makes us spend money.
 */
export function collapseLocalPack(elements: readonly SerpElement[]): SerpElement[] {
  const ordered = [...elements].sort((a, b) => a.rank - b.rank);
  const out: SerpElement[] = [];
  // The run's LAST raw rank, not the merged block's rank — the block keeps the first rank, so
  // comparing against it would stop matching at the third sibling (it did; a test caught it).
  let runEndRank = Number.NaN;
  for (const el of ordered) {
    const prev = out[out.length - 1];
    if (el.kind === 'local_pack' && prev?.kind === 'local_pack' && runEndRank === el.rank - 1) {
      prev.entries = (prev.entries ?? 1) + (el.entries ?? 1);
      runEndRank = el.rank;
      continue;
    }
    out.push({ ...el });
    runEndRank = el.rank;
  }
  return out;
}

export const dataForSeoProvider: SerpProvider = {
  name: 'dataforseo',
  configured: serpConfigured,
  async fetchSerp(query: string, location: string): Promise<SerpSnapshot> {
    if (!serpConfigured()) throw new Error('DataForSEO is not configured (DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD).');
    const auth = Buffer.from(`${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`).toString('base64');
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([
        {
          keyword: query,
          location_name: location,
          language_code: 'en',
          device: 'desktop',
          // The measurement is what sits above organic, so we need the whole page, not a filter.
          depth: 30,
          // ⚠️ WITHOUT THIS, THE AI OVERVIEW COMES BACK AS AN EMPTY PLACEHOLDER and a local pack
          // rendered inside it is invisible — which is how `horse barn builder austin` scored 100%
          // pack-free over 23 readings while the real page carried "Local Horse Barn Builders" with
          // Call / Directions / Website buttons above every organic result. 59% of readings taken
          // before 2026-09-24 have this hole in them.
          //
          // ⚠️ IT IS FREE. Measured over three paired queries: mean $0.0053 with the flag and
          // $0.0053 without — cost varies with page size, not with this. An earlier estimate that
          // it "roughly doubles per-check cost" was wrong and stopped a correct fix for an hour.
          load_async_ai_overview: true,
        },
      ]),
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`DataForSEO HTTP ${res.status}`);
    const json = (await res.json()) as {
      tasks?: Array<{ status_code?: number; status_message?: string; result?: Array<{ items?: RawItem[] }> }>;
    };
    const task = json?.tasks?.[0];
    if (!task || (task.status_code && task.status_code !== 20000)) {
      throw new Error(`DataForSEO task error: ${task?.status_message ?? 'unknown'}`);
    }
    const items = task.result?.[0]?.items ?? [];
    return {
      query,
      location,
      fetchedAt: new Date().toISOString(),
      elements: collapseLocalPack(mapItems(items)),
      raw: json,
    };
  },
};
