// lib/serp/types.ts
//
// One SERP, reduced to the only question docs/SERP_CHECK_WORKSHEET.md asks:
// WHAT IS ABOVE THE FIRST ORGANIC RESULT — not where we rank.
//
// Deliberately provider-shaped-agnostic. `lib/serp/dataforseo.ts` maps one vendor's payload
// into this; `lib/serp/classify.ts` is pure over it. Swapping vendors must not touch the rules.

/** The element kinds that can push an organic result down the page. */
export const BLOCKING_KINDS = [
  'paid',
  'local_pack',
  'ai_overview',
  'people_also_ask',
  'shopping',
  'images',
  'video',
  'featured_snippet',
  'knowledge_graph',
  'top_stories',
  'twitter',
  'other',
] as const;
export type BlockingKind = (typeof BLOCKING_KINDS)[number];

export type SerpElement = {
  kind: BlockingKind | 'organic';
  /** Position across ALL elements, 1-based, as the page stacks them. */
  rank: number;
  /** Organic only: the result's hostname, lowercased, no `www.`. */
  domain?: string;
  /** local_pack only: how many businesses it lists. 3 = full, 1–2 = starved. */
  entries?: number;
};

export type SerpSnapshot = {
  query: string;
  /** How the location was expressed to the provider, e.g. "Asheville,North Carolina,United States". */
  location: string;
  fetchedAt: string;
  elements: SerpElement[];
  /** The provider's raw response, kept so a re-classification never needs a re-fetch (it costs money). */
  raw?: unknown;
};

export type SerpProvider = {
  name: string;
  configured(): boolean;
  fetchSerp(query: string, location: string): Promise<SerpSnapshot>;
};
