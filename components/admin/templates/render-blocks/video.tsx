'use client';

import type { VideoBlock } from '@/types/blocks';

export default function VideoBlock({ content }: { content: VideoBlock['content'] }) {
  return (
    <div className="mb-4">
      <video controls className="max-w-full rounded">
        <source src={content.url} />
      </video>
      {content.caption && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {content.caption}
        </p>
      )}
    </div>
  );
}
