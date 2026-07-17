'use client';

// components/admin/templates/render-blocks/gallery.tsx
//
// Photo gallery — a responsive image grid with a click-to-enlarge lightbox (prev/next,
// Esc to close, arrow keys). The block nearly every visual business needs. Emits
// ImageGallery JSON-LD. Renders nothing if there are no images.

import * as React from 'react';
import type { Block } from '@/types/blocks';

type Img = { url?: string; caption?: string; alt?: string };
type Props = { block?: Block; content?: Block['content'] };
const s = (v: any) => (typeof v === 'string' ? v.trim() : '');

export default function RenderGallery({ block, content }: Props) {
  const c: any = content ?? block?.content ?? {};
  const title = s(c.title) || 'Gallery';
  const columns = Math.min(4, Math.max(2, Number(c.columns) || 3));
  const images: Img[] = (Array.isArray(c.images) ? c.images : []).filter((i: Img) => s(i.url));

  const [open, setOpen] = React.useState<number | null>(null);
  const close = React.useCallback(() => setOpen(null), []);
  const step = React.useCallback((d: number) => setOpen((cur) => (cur == null ? cur : (cur + d + images.length) % images.length)), [images.length]);

  React.useEffect(() => {
    if (open == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') step(1);
      else if (e.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close, step]);

  if (!images.length) return null;

  const colClass = columns === 2 ? 'sm:grid-cols-2' : columns === 4 ? 'sm:grid-cols-3 lg:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ImageGallery',
    ...(s(c.title) ? { name: s(c.title) } : {}),
    image: images.map((i) => s(i.url)),
  };

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <h2 className="mb-6 text-2xl font-bold tracking-tight">{title}</h2>
      <div className={`grid grid-cols-2 gap-3 ${colClass}`}>
        {images.map((img, i) => (
          <button key={i} type="button" onClick={() => setOpen(i)}
            className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-muted focus:outline-none focus:ring-2 focus:ring-primary">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s(img.url)} alt={s(img.alt) || s(img.caption) || `Photo ${i + 1}`} loading="lazy"
              className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
            {s(img.caption) && (
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-left text-xs font-medium text-white">
                {s(img.caption)}
              </span>
            )}
          </button>
        ))}
      </div>

      {open != null && (
        <div role="dialog" aria-modal="true" onClick={close}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4">
          <button type="button" onClick={close} aria-label="Close" className="absolute right-4 top-4 text-2xl text-white/80 hover:text-white">✕</button>
          {images.length > 1 && (
            <>
              <button type="button" onClick={(e) => { e.stopPropagation(); step(-1); }} aria-label="Previous"
                className="absolute left-2 text-3xl text-white/70 hover:text-white sm:left-6">‹</button>
              <button type="button" onClick={(e) => { e.stopPropagation(); step(1); }} aria-label="Next"
                className="absolute right-2 text-3xl text-white/70 hover:text-white sm:right-6">›</button>
            </>
          )}
          <figure onClick={(e) => e.stopPropagation()} className="max-h-full max-w-4xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s(images[open].url)} alt={s(images[open].alt) || s(images[open].caption) || 'Photo'} className="max-h-[85vh] w-auto rounded-lg object-contain" />
            {s(images[open].caption) && <figcaption className="mt-2 text-center text-sm text-white/80">{s(images[open].caption)}</figcaption>}
          </figure>
        </div>
      )}
    </section>
  );
}
