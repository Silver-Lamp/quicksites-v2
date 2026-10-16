// lib/templates/publishState.ts
//
// Does the live site match the latest saved draft? One pure answer for the editor's top bar
// (owner, 2026-10-16: "we need a visual indicator at the top when a published site differs
// from the latest changes").
//
// ⚠️ A SITE IS SERVED FROM TWO SNAPSHOTS (CLAUDE.md §5b): `published_sites → template_versions`
// for the platform slug, and the legacy `sites.published_snapshot_id → snapshots` for a custom
// domain. "Up to date" means the draft matches EVERY copy that serves; a republish that refreshed
// one and not the other reads as changed on the domain, which is the truth a status word usually
// hides.
//
// The comparison is structural over the content a visitor can see — pages, header, footer,
// meta, services, color mode — with keys sorted, so a re-save that reorders keys is not a change.

export type PublishStatus = 'not_published' | 'up_to_date' | 'changed';
export type PublishState = {
  status: PublishStatus;
  /** Which served copies differ from the draft (empty unless `changed`). */
  changedWhere: Array<'platform' | 'domain'>;
  publishedAt: string | null;
};

const COMPARED_KEYS = ['pages', 'headerBlock', 'footerBlock', 'meta', 'services', 'color_mode', 'identity'] as const;

/** JSON with object keys sorted at every level, so equality is about content, not insertion order. */
export function canonicalJson(value: unknown): string {
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      return Object.keys(o)
        .sort()
        .reduce<Record<string, unknown>>((acc, k) => {
          if (o[k] !== undefined) acc[k] = walk(o[k]);
          return acc;
        }, {});
    }
    return v;
  };
  return JSON.stringify(walk(value));
}

/** The visible slice of a template `data` object. */
export function visibleContent(data: unknown): Record<string, unknown> {
  const d = (data ?? {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of COMPARED_KEYS) if (k in d) out[k] = d[k];
  return out;
}

export function contentDiffers(a: unknown, b: unknown): boolean {
  return canonicalJson(visibleContent(a)) !== canonicalJson(visibleContent(b));
}

export function publishStateFor(input: {
  draft: unknown;
  /** `template_versions.full_data` of the published_sites snapshot; null when never published. */
  platform: unknown | null;
  /** `snapshots.data` of the legacy sites row; null when the site has no custom-domain copy. */
  domain?: unknown | null;
  publishedAt?: string | null;
}): PublishState {
  if (input.platform == null && input.domain == null) return { status: 'not_published', changedWhere: [], publishedAt: null };
  const changedWhere: PublishState['changedWhere'] = [];
  if (input.platform != null && contentDiffers(input.draft, input.platform)) changedWhere.push('platform');
  if (input.domain != null && contentDiffers(input.draft, input.domain)) changedWhere.push('domain');
  return { status: changedWhere.length ? 'changed' : 'up_to_date', changedWhere, publishedAt: input.publishedAt ?? null };
}
