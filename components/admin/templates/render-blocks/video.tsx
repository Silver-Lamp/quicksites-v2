'use client';

import type { Block } from '@/types/blocks';

export default function VideoBlock({ content }: { content: Block['content'] }) {
  return (
    <div className="mb-4">
      <video controls className="max-w-full rounded">
        <source src={content.url} />
      </video>
      {content.caption && (
        <p className="text-sm text-muted-foreground mt-1">
          {content.caption}
        </p>
      )}
    </div>
  );
}
