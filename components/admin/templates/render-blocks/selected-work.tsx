'use client';

// components/admin/templates/render-blocks/selected-work.tsx
//
// A named index of work — the shape a photographer, designer, illustrator or author actually
// sells on. Benchmarked against louver.framer.website, whose whole middle is seven entries
// ("Solstice", "Lane Seven", "Terracotta Hour"…), each one title + meta + a single image.
//
// ⚠️ WHY THIS IS NOT THE GALLERY. A gallery is a wall of images: good for "here is my work",
// useless for "here is the work I did FOR SOMEONE, and what it was". The thing that reads as
// professional is the credit line — a title, a year, a client — and a grid of untitled JPEGs
// cannot carry one. Authors get the same shape for books: title, publisher, a cover.
//
// ⚠️ EMPTY RENDERS NOTHING IN PUBLIC AND A PROMPT IN THE EDITOR. Both halves are load-bearing:
// an empty "Selected work" heading tells a visitor this person has done none, and a block that
// is silent in the builder too is one nobody discovers — which is how `gallery` and `reviews`
// reached zero of ~2,800 sites while fully built.

import * as React from 'react';
import type { Block } from '@/types/blocks';
import { isEditorContext } from '@/lib/editor/isEditorContext';

type Item = { title?: string; meta?: string; blurb?: string; image?: string; href?: string };
type Props = { block?: Block; content?: Block['content']; previewOnly?: boolean };

const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

export default function RenderSelectedWork({ block, content, previewOnly }: Props) {
  const c: any = content ?? block?.content ?? {};
  const title = s(c.title) || 'Selected work';
  const layout: 'list' | 'grid' = c.layout === 'grid' ? 'grid' : 'list';

  // ⚠️ A row counts only if it has a TITLE. An entry with just an image belongs in the gallery;
  // here it would render as an untitled credit, which is the thing this block exists to avoid.
  const items: Item[] = (Array.isArray(c.items) ? c.items : []).filter((i: Item) => s(i.title));

  if (!items.length) {
    if (!isEditorContext(previewOnly)) return null;
    return (
      <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
        <div className="text-base">🗂️</div>
        Selected work — add pieces in this block&apos;s panel: a title, and optionally a year,
        client or publisher. Nothing shows on your live site until you do.
      </div>
    );
  }

  return (
    <section className="py-10">
      <h2 className="mb-6 text-2xl font-bold tracking-tight text-foreground">{title}</h2>

      {layout === 'grid' ? (
        <ul className="grid list-none gap-6 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it, i) => (
            <li key={`${s(it.title)}-${i}`}>
              <Entry item={it} grid />
            </li>
          ))}
        </ul>
      ) : (
        // A list reads like a CV: one line per credit, image optional and small.
        <ul className="list-none divide-y divide-border p-0">
          {items.map((it, i) => (
            <li key={`${s(it.title)}-${i}`} className="py-4">
              <Entry item={it} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Entry({ item, grid = false }: { item: Item; grid?: boolean }) {
  const href = s(item.href);
  const image = s(item.image);
  const title = s(item.title);
  const meta = s(item.meta);
  const blurb = s(item.blurb);

  const body = (
    <div className={grid ? '' : 'flex items-baseline gap-4'}>
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element -- owner-supplied URL, any host.
        <img
          src={image}
          // ⚠️ The title, not a filename and not "image": a screen reader should hear the credit.
          alt={title}
          loading="lazy"
          className={
            grid
              ? 'mb-3 aspect-[4/3] w-full rounded-lg object-cover'
              : 'hidden h-14 w-20 shrink-0 rounded object-cover sm:block'
          }
        />
      ) : null}
      <div className={grid ? '' : 'min-w-0 flex-1'}>
        <div className="flex flex-wrap items-baseline gap-x-3">
          <span className="font-medium text-foreground">{title}</span>
          {meta ? <span className="text-sm text-muted-foreground">{meta}</span> : null}
        </div>
        {blurb ? <p className="mt-1 text-sm leading-snug text-muted-foreground">{blurb}</p> : null}
      </div>
    </div>
  );

  if (!href) return body;
  // ⚠️ `noopener` on every outbound link: without it the opened page can reach back through
  // `window.opener` and navigate this one.
  const external = /^https?:\/\//i.test(href);
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className="block rounded transition hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
    >
      {body}
    </a>
  );
}
