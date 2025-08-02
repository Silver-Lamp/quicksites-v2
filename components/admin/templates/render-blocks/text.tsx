'use client';

import type { Block } from '@/types/blocks';
import SectionShell from '@/components/ui/section-shell';

type Props = {
  block?: Block;
  content?: Block['content'];
  compact?: boolean;
  colorMode?: 'light' | 'dark';
};

export default function TextRender({ block, content, compact = false, colorMode = 'dark' }: Props) {
  const final = content || block?.content;

  if (!final || !final.value?.trim()) {
    return (
      <div className={`${colorMode === 'dark' ? 'text-red-500 italic text-sm p-2 bg-red-50 dark:bg-red-900/20' : 'text-red-500 italic text-sm p-2 bg-red-50/20'} rounded`}>
        ⚠️ Missing text block content.
      </div>
    );
  }

  return (
    <SectionShell compact={compact}>
      <p className={`text-base ${colorMode === 'dark' ? 'text-gray-900 dark:text-gray-100' : 'text-black'} leading-relaxed`}>
        {final.value}
      </p>
    </SectionShell>
  );
}
