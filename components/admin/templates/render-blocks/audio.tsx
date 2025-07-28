'use client';

import type { Block } from '@/types/blocks';

export default function AudioBlock({ content }: { content: Block['content'] }) {
  return (
    <div className="mb-4">
      <iframe
        className="w-full"
        style={{ height: 80 }}
        src={content.url}
        title={content.title || content.provider}
        allow="autoplay; encrypted-media"
        loading="lazy"
      />
    </div>
  );
}
