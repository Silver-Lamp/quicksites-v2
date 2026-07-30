// components/admin/templates/render-blocks/testimonial.tsx
'use client';

import type { Block } from '@/types/blocks';
import type { Template } from '@/types/template';
import { Star } from 'lucide-react';
import Image from 'next/image';

type TestimonialItem = {
  quote: string;
  attribution?: string;
  avatar_url?: string;
  rating?: number; // 1..5
};

type TestimonialContent = {
  title?: string;
  randomized?: boolean;
  testimonials?: TestimonialItem[];
};

function renderStars(rating?: number) {
  const n = Math.max(0, Math.min(5, Number(rating ?? 0)));
  if (!n) return null;
  return (
    <div className="flex gap-1 text-yellow-500 mt-1">
      {Array.from({ length: n }).map((_, i) => (
        <Star key={i} className="w-4 h-4 fill-yellow-500" />
      ))}
    </div>
  );
}

// Prefer explicit override, then block.content, then block.props
function pickContent(block?: Block, override?: Block['content']): TestimonialContent {
  const c = (override as TestimonialContent) ?? (block?.content as TestimonialContent);
  const p = (block as any)?.props as TestimonialContent | undefined;

  const title = c?.title ?? p?.title ?? 'Testimonials';
  const randomized = c?.randomized ?? p?.randomized ?? false;
  const testimonials =
    (Array.isArray(c?.testimonials) && c!.testimonials!.length ? c!.testimonials! :
     Array.isArray(p?.testimonials) ? p!.testimonials! : []);

  return { title, randomized, testimonials };
}

export default function TestimonialBlock({
  block,
  compact = false,
  colorMode = 'dark',
  template, // (unused here, but kept for parity with your API)
  content,  // allow optional override like other renderers
  previewOnly,
}: {
  block: Block;
  compact?: boolean;
  colorMode?: 'light' | 'dark';
  template: Template;
  content?: Block['content'];
  /** True in the editor/preview. The PUBLISHED render must stay silent when empty. */
  previewOnly?: boolean;
}) {
  const final = pickContent(block, content);
  const all: TestimonialItem[] = final.testimonials ?? [];

  // ⚠️ AI SAMPLES NEVER REACH A VISITOR.
  //
  // The testimonial editor can generate testimonials ("Generate" / "Replace all with AI") and
  // stamps each `ai_generated: true`. The editor is honest about it — every generated item
  // carries a purple "AI Sample" badge, so the operator always knows which are invented.
  //
  // That badge stopped at the editor door. This renderer never read the flag, so on the
  // published page an invented "Jake M. ★★★★★" rendered identically to a real customer's
  // review. Four live sites were serving exactly that. The honesty existed and did not survive
  // publication, which is the worst place for it to fail — the operator, who already knows,
  // was told; the visitor, who cannot know, was not.
  //
  // So generated items are DRAFTING AIDS: useful against blank-page paralysis, invisible to
  // the public. Every edit path in the editor already sets `ai_generated: false`, so an
  // operator who rewrites a sample in a real customer's words publishes it normally — the
  // gate is "a human has touched this", and it was already being recorded.
  const publishable = previewOnly ? all : all.filter((t) => !(t as any)?.ai_generated);

  const list: TestimonialItem[] = final.randomized
    ? [...publishable].sort(() => 0.5 - Math.random())
    : publishable;

  // ⚠️ SILENT UNTIL FILLED — the about_that pattern. The block now ships EMPTY (its default no
  // longer carries a fabricated quote), so without this a visitor to a real business's site
  // would read a "Testimonials" heading over "No testimonials yet." — advertising the absence,
  // which is worse than omitting the section. In the editor the prompt still shows, because
  // that is where the owner can act on it.
  if (!list.length && !previewOnly) return null;

  return (
    <section className="px-6 py-12">
      <div className="mx-auto max-w-4xl">
        <h2 className="text-2xl font-bold mb-6 text-foreground">{final.title}</h2>

        <div className={`grid gap-4 ${compact ? 'text-sm' : 'text-base'}`}>
          {list.map((t, i) => (
            <div
              key={`${t.attribution ?? 'anon'}-${t.quote?.slice(0, 24)}-${i}`}
              className={`relative border-l-4 border-primary pl-4 italic rounded ${
                compact
                  ? 'text-muted-foreground bg-transparent'
                  : 'text-card-foreground bg-card p-4 shadow-sm'
              }`}
            >
              {t.avatar_url && (
                <Image
                  src={t.avatar_url}
                  alt={t.attribution || 'Avatar'}
                  width={40}
                  height={40}
                  className="rounded-full absolute -left-5 top-2 border border-border shadow"
                />
              )}
              <p>“{t.quote}”</p>
              {t.attribution && (
                <footer className="mt-1 text-sm text-primary not-italic font-medium">— {t.attribution}</footer>
              )}
              {renderStars(t.rating)}
            </div>
          ))}

          {list.length === 0 && (
            <p className="italic p-4 rounded-md text-muted-foreground bg-muted">
              No testimonials yet — add a real one from a real customer.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
