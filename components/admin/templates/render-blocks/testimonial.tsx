// components/admin/templates/render-blocks/testimonial.tsx
'use client';

import ThemeScope from '@/components/ui/theme-scope';
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
}: {
  block: Block;
  compact?: boolean;
  colorMode?: 'light' | 'dark';
  template: Template;
  content?: Block['content'];
}) {
  const final = pickContent(block, content);
  const list: TestimonialItem[] = final.randomized
  ? [...(final.testimonials ?? [])].sort(() => 0.5 - Math.random())
  : (final.testimonials ?? []);

  return (
    <ThemeScope mode={colorMode} className={`p-6 rounded-md ${colorMode === 'light' ? 'bg-white' : 'bg-neutral-950'}`}>
      <h2
        className={`text-2xl font-bold mb-6 p-4 rounded-md ${
          colorMode === 'light' ? 'text-blue-900 bg-white' : 'text-white bg-neutral-950'
        }`}
      >
        {final.title}
      </h2>

      <div className={`grid gap-4 ${compact ? 'text-sm' : 'text-base'}`}>
        {list.map((t, i) => (
          <div
            key={`${t.attribution ?? 'anon'}-${t.quote?.slice(0, 24)}-${i}`}
            className={`relative border-l-4 pl-4 italic rounded ${
              compact
                ? colorMode === 'light'
                  ? 'border-blue-400 text-zinc-700 bg-transparent'
                  : 'border-blue-400 text-zinc-300 bg-transparent'
                : colorMode === 'light'
                  ? 'border-blue-500 text-zinc-800 bg-white p-4'
                  : 'border-blue-500 text-zinc-200 bg-neutral-900 p-4'
            }`}
          >
            {t.avatar_url && (
              <Image
                src={t.avatar_url}
                alt={t.attribution || 'Avatar'}
                width={40}
                height={40}
                className={`rounded-full absolute -left-5 top-2 border shadow ${
                  colorMode === 'light' ? 'border-white' : 'border-zinc-800'
                }`}
              />
            )}
            <p>“{t.quote}”</p>
            {t.attribution && (
              <footer className={`mt-1 text-sm ${colorMode === 'light' ? 'text-blue-600' : 'text-blue-300'}`}>
                — {t.attribution}
              </footer>
            )}
            {renderStars(t.rating)}
          </div>
        ))}

        {list.length === 0 && (
          <p className={`italic p-4 rounded-md ${colorMode === 'light' ? 'text-zinc-400 bg-zinc-50' : 'text-zinc-600 bg-neutral-900'}`}>
            No testimonials yet.
          </p>
        )}
      </div>
    </ThemeScope>
  );
}
