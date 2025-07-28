'use client';

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
    <div className="flex gap-1 text-yellow-400 mt-1">
      {Array.from({ length: rating }).map((_, i) => (
        <Star key={i} className="w-4 h-4 fill-yellow-400" />
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
  const content = block?.content as unknown as { testimonials: TestimonialItem[]; randomized?: boolean } | undefined;
  const testimonials: TestimonialItem[] = content?.testimonials ?? [];
  const randomized = content?.randomized;
  const list = randomized ? [...testimonials].sort(() => 0.5 - Math.random()) : testimonials;

  return (
    <div className={`grid gap-4 ${compact ? 'text-sm' : 'text-base'}`}>
      {list.map((t: TestimonialItem, i: number) => (
        <div
          key={i}
          className={`border-l-4 pl-4 italic relative ${
            compact
              ? 'border-blue-400 text-gray-700 dark:text-gray-300'
              : 'border-blue-500 text-gray-800 dark:text-gray-200 bg-white dark:bg-neutral-900 p-4 rounded'
          }`}
        >
          {t.avatar_url && (
            <Image
              src={t.avatar_url}
              alt={t.attribution || 'Avatar'}
              width={40}
              height={40}
              className="rounded-full absolute -left-5 top-2 border border-white shadow"
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
        <p className="text-gray-400 italic">No testimonials yet.</p>
      )}
    </div>
  );
}
