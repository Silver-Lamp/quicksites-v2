'use client';

import type { Block } from '@/types/blocks';
import SectionShell from '@/components/ui/section-shell';

type CtaBlock = Extract<Block, { type: 'cta' }>;

type Props = {
  block?: CtaBlock;
  content?: CtaBlock['content'];
  compact?: boolean;
};

export default function CtaRender({ block, content, compact = false }: Props) {
  const final = content || block?.content;

  if (!final || !final.label || !final.link) {
    return (
      <div className="text-red-500 italic text-sm p-2 bg-red-50 dark:bg-red-900/20 rounded">
        ⚠️ Missing content for CTA block.
      </div>
    );
  }

  return (
    <SectionShell
      compact={compact}
      textAlign={compact ? 'left' : 'center'}
    >
      <a
        href={final.link}
        className={`inline-block font-medium transition ${
          compact
            ? 'text-sm px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700'
            : 'px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700'
        }`}
      >
        {final.label}
      </a>
    </SectionShell>
  );
}
