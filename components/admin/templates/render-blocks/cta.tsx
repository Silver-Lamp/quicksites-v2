'use client';

import type { Block } from '@/types/blocks';
import SectionShell from '@/components/ui/section-shell';

type Props = {
  block?: Block;
  content?: Block['content'];
  compact?: boolean;
};

export default function CtaRender({ block, content, compact = false }: Props) {
  const final = content || block?.content;

  // Read `href` first — it is the schema's field, so it is the one that survives validation.
  // `link` is the older spelling that scaffolds still write; kept as a fallback for any block
  // read straight from the DB without passing through the schema. Never require `link`: doing
  // so is what made every CTA in the fleet render as the error below.
  const url = (final as any)?.href || (final as any)?.link;

  if (!final || !final.label || !url) {
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
        href={url}
        className={`inline-block font-medium transition bg-primary text-primary-foreground rounded hover:opacity-90 ${
          compact ? 'text-sm px-3 py-1' : 'px-6 py-2'
        }`}
      >
        {final.label}
      </a>
    </SectionShell>
  );
}
