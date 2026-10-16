'use client';

// components/admin/templates/render-blocks/video-showcase.tsx
//
// Up to three portrait videos shown together, tilted like phones laid on a table until one is
// played, pulled up over the bottom of the block above (the hero) so the row reads as part of
// the opening rather than a section further down. Built for the B Hard commercials (owner,
// 2026-10-16: "overlaid on the header slightly tilted until played, and an h2 of 'Ok, now
// that's new!'"). The cards themselves are `components/sites/media-cards.tsx`, shared with the
// hero's `media_split` layout — which is now the standard way to get this look; this block
// remains for a row of videos placed anywhere else on a page.
//
// ⚠️ EMPTY RENDERS NOTHING IN PUBLIC (the products_grid / video rule): a showcase with no
// videos is an editor hint, never a row of empty black cards on a live site.

import * as React from 'react';
import type { Block } from '@/types/blocks';
import { isEditorContext } from '@/lib/editor/isEditorContext';
import { MediaCards } from '@/components/sites/media-cards';
import type { HeroMediaItem } from '@/lib/sites/heroMedia';

type Item = { url: string; poster?: string; caption?: string };
type Props = { block?: Block; content?: Block['content']; template?: unknown; previewOnly?: boolean };

export function readShowcaseVideos(content: unknown): Item[] {
  const c = (content ?? {}) as { videos?: unknown };
  const list = Array.isArray(c.videos) ? c.videos : [];
  return list
    .filter((v: any): v is Item => !!v && typeof v.url === 'string' && /^https?:\/\//.test(v.url.trim()))
    .slice(0, 3)
    .map((v: any) => ({
      url: String(v.url).trim(),
      poster: typeof v.poster === 'string' && /^https?:\/\//.test(v.poster.trim()) ? v.poster.trim() : undefined,
      caption: typeof v.caption === 'string' ? v.caption.trim() : undefined,
    }));
}

export default function RenderVideoShowcase({ block, content, previewOnly }: Props) {
  const c: any = content ?? block?.content ?? {};
  const videos = readShowcaseVideos(c);

  if (!videos.length) {
    if (!isEditorContext(previewOnly)) return null;
    return (
      <div className="mb-4 rounded-lg border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">
        Video showcase — add up to three portrait videos in this block&apos;s panel. Nothing shows on your live site until you do.
      </div>
    );
  }

  const tilt = c.tilt !== false;
  const overlap = c.overlap !== false;
  const heading = typeof c.heading === 'string' ? c.heading.trim() : '';
  const hero = c.hero && typeof c.hero === 'object' && typeof c.hero.headline === 'string' && c.hero.headline.trim() ? c.hero : null;
  const items: HeroMediaItem[] = videos.map((v) => ({ kind: 'video', ...v }));
  const phones = <div className={hero ? '' : 'mx-auto max-w-4xl'}><MediaCards items={items} tilt={tilt} /></div>;

  if (hero) {
    const img = typeof hero.image_url === 'string' && /^https?:\/\//.test(hero.image_url.trim()) ? hero.image_url.trim() : '';
    const ctaText = typeof hero.cta_text === 'string' ? hero.cta_text.trim() : '';
    const ctaLink = typeof hero.cta_link === 'string' && hero.cta_link.trim() ? hero.cta_link.trim() : '#contact';
    return (
      <section data-video-showcase="1" data-video-showcase-hero="1" className="relative z-10 px-4 py-10 sm:py-14">
        <div className="mx-auto grid max-w-6xl items-center gap-10 md:grid-cols-2">
          <div className="text-center md:text-left">
            {img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={img} alt={typeof hero.image_alt === 'string' ? hero.image_alt : hero.headline} className="mx-auto mb-6 w-full max-w-[260px] rounded-xl md:mx-0" />
            ) : null}
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">{hero.headline}</h1>
            {hero.subheadline ? <p className="mt-4 text-lg text-muted-foreground">{hero.subheadline}</p> : null}
            {ctaText ? (
              <a href={ctaLink} className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-full bg-primary px-6 py-3 text-base font-bold text-primary-foreground transition hover:opacity-90">
                {ctaText}
              </a>
            ) : null}
          </div>
          <div>
            {heading ? <h2 className="mb-5 text-center text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{heading}</h2> : null}
            {phones}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section data-video-showcase="1" className={`relative z-10 px-4 ${overlap ? '-mt-6 pb-10 sm:-mt-12' : 'py-10'}`}>
      {heading ? <h2 className="mb-6 text-center text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{heading}</h2> : null}
      {phones}
    </section>
  );
}
