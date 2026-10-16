// lib/sites/heroMedia.ts
//
// The hero's `media` items (the tilted phone-shaped cards beside the headline in the
// `media_split` layout) — one parser shared by the renderer, the editor and Shuffle. Pure.
export type HeroMediaItem = { kind: 'image' | 'video'; url: string; poster?: string; caption?: string };

const isHttp = (s: unknown): s is string => typeof s === 'string' && /^https?:\/\//.test(s.trim());

/** Up to three valid items; anything without an https URL is dropped, never guessed. */
export function parseHeroMedia(content: unknown): HeroMediaItem[] {
  const list = Array.isArray((content as any)?.media) ? ((content as any).media as unknown[]) : [];
  return list
    .filter((m: any) => m && isHttp(m.url))
    .slice(0, 3)
    .map((m: any) => ({
      kind: m.kind === 'image' || /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(String(m.url)) && m.kind !== 'video' ? 'image' : 'video',
      url: String(m.url).trim(),
      poster: isHttp(m.poster) ? m.poster.trim() : undefined,
      caption: typeof m.caption === 'string' && m.caption.trim() ? m.caption.trim() : undefined,
    }));
}

/** Does this template's hero carry media? Shuffle offers `media_split` only when it does. */
export function heroHasMedia(data: unknown): boolean {
  for (const pg of (data as any)?.pages ?? []) {
    for (const b of pg?.blocks ?? pg?.content_blocks ?? []) {
      if (b?.type !== 'hero') continue;
      if (parseHeroMedia(b.content ?? b.props).length) return true;
    }
  }
  return false;
}
