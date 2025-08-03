'use client';

import ThemeScope from '@/components/ui/theme-scope';
import type { Block } from '@/types/blocks';
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
}: {
  block: Block;
  compact?: boolean;
}) {
  const content = block?.content as { testimonials: TestimonialItem[]; randomized?: boolean } | undefined;
  const testimonials: TestimonialItem[] = content?.testimonials ?? [];
  const randomized = content?.randomized;
  const list = randomized ? [...testimonials].sort(() => 0.5 - Math.random()) : testimonials;

  return (
    <ThemeScope mode="dark" className={`bg-white dark:bg-neutral-950 p-6 rounded-md`}>
      <h2 className="text-2xl font-bold text-blue-900 dark:text-white mb-6 p-4 bg-white dark:bg-neutral-950 rounded-md">
        {block.content?.title || 'Testimonials'}
      </h2>

      <div className={`grid gap-4 ${compact ? 'text-sm' : 'text-base'}`}>
        {list.map((t: TestimonialItem, i: number) => (
          <div
            key={i}
            className={`relative border-l-4 pl-4 italic rounded ${
              compact
                ? 'border-blue-400 text-zinc-700 dark:text-zinc-300 bg-transparent dark:bg-neutral-950'
                : 'border-blue-500 text-zinc-800 dark:text-zinc-200 bg-white dark:bg-neutral-900 p-4'
            }`}
          >
            {t.avatar_url && (
              <Image
                src={t.avatar_url}
                alt={t.attribution || 'Avatar'}
                width={40}
                height={40}
                className="rounded-full absolute -left-5 top-2 border border-white dark:border-zinc-800 shadow"
              />
            )}
            <p>“{t.quote}”</p>
            {t.attribution && (
              <footer className="mt-1 text-sm text-blue-600 dark:text-blue-300">
                — {t.attribution}
              </footer>
            )}
            {renderStars(t.rating)}
          </div>
        ))}

        {list.length === 0 && (
          <p className="text-zinc-400 dark:text-zinc-600 italic bg-zinc-50 dark:bg-neutral-900 p-4 rounded-md">
            No testimonials yet.
          </p>
        )}
      </div>
    </ThemeScope>
  );
}
