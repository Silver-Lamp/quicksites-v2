// components/admin/templates/render-blocks/testimonial.tsx
'use client';

import ThemeScope from '@/components/ui/theme-scope';
import type { Block } from '@/types/blocks';
import { Template } from '@/types/template';
import { Star } from 'lucide-react';
import Image from 'next/image';

type TestimonialItem = {
  quote: string;
  attribution?: string;
  avatar_url?: string;
  rating?: number;
};

function renderStars(rating?: number) {
  if (!rating) return null;
  return (
    <div className="flex gap-1 text-yellow-500 mt-1">
      {Array.from({ length: rating }).map((_, i) => (
        <Star key={i} className="w-4 h-4 fill-yellow-500" />
      ))}
    </div>
  );
}

export default function TestimonialBlock({
  block,
  compact = false,
  colorMode = 'dark', // <-- now accepts colorMode from props
  template,
}: {
  block: Block;
  compact?: boolean;
  colorMode?: 'light' | 'dark';
  template: Template;
}) {
  const content = block?.content as { testimonials: TestimonialItem[]; randomized?: boolean; title?: string } | undefined;
  const testimonials: TestimonialItem[] = content?.testimonials ?? [];
  const randomized = content?.randomized;
  const list = randomized ? [...testimonials].sort(() => 0.5 - Math.random()) : testimonials;

  return (
    <ThemeScope mode={colorMode} className={`p-6 rounded-md ${colorMode === 'light' ? 'bg-white' : 'bg-neutral-950'}`}>
      <h2
        className={`text-2xl font-bold mb-6 p-4 rounded-md ${
          colorMode === 'light'
            ? 'text-blue-900 bg-white'
            : 'text-white bg-neutral-950'
        }`}
      >
        {content?.title || 'Testimonials'}
      </h2>

      <div className={`grid gap-4 ${compact ? 'text-sm' : 'text-base'}`}>
        {list.map((t: TestimonialItem, i: number) => (
          <div
            key={i}
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
              <footer
                className={`mt-1 text-sm ${
                  colorMode === 'light' ? 'text-blue-600' : 'text-blue-300'
                }`}
              >
                — {t.attribution}
              </footer>
            )}
            {renderStars(t.rating)}
          </div>
        ))}

        {list.length === 0 && (
          <p
            className={`italic p-4 rounded-md ${
              colorMode === 'light'
                ? 'text-zinc-400 bg-zinc-50'
                : 'text-zinc-600 bg-neutral-900'
            }`}
          >
            No testimonials yet.
          </p>
        )}
      </div>
    </ThemeScope>
  );
}
