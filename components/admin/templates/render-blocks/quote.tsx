'use client';

import type { Block } from '@/types/blocks';
import SectionShell from '@/components/ui/section-shell';

type Props = {
  block?: Block;
  content?: Block['content'];
  compact?: boolean;
};

export default function QuoteRender({ block, content, compact = false }: Props) {
  const final = content || block?.content;

  if (!final || !final.text?.trim()) {
    return (
      <blockquote className="text-red-500 italic text-sm p-2 bg-red-500/10 rounded">
        ⚠️ Missing content for quote block.
      </blockquote>
    );
  }

  return (
    <SectionShell compact={compact}>
      <blockquote
        className={`border-l-4 pl-4 italic ${
          compact
            ? 'text-sm border-border text-foreground'
            : 'mb-4 border-border text-foreground'
        }`}
      >
        “{final.text}”
        {final.attribution && (
          <footer
            className={`mt-1 ${
              compact ? 'text-xs text-right' : 'text-sm text-right'
            } text-muted-foreground`}
          >
            — {final.attribution}
          </footer>
        )}
      </blockquote>
    </SectionShell>
  );
}
