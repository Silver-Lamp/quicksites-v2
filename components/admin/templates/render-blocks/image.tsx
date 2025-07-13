'use client';

import type { ImageBlock } from '@/types/blocks';

export default function ImageBlock({ content }: { content: ImageBlock['content'] }) {
  return (
    <img
      src={content.url}
      alt={content.alt}
      className="mb-4 rounded shadow-md max-w-full"
    />
  );
}
