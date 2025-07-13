'use client';

import type { CtaBlock } from '@/types/blocks';

export default function CtaBlock({ content }: { content?: CtaBlock['content'] }) {
  if (!content) {
    return <div className="text-red-500 italic">⚠️ Missing content for CTA block.</div>;
  }

  return (
    <div className="mb-6 text-center">
      <a
        href={content.link}
        className="inline-block px-6 py-2 bg-green-600 text-white rounded font-medium hover:bg-green-700 transition"
      >
        {content.label}
      </a>
    </div>
  );
}