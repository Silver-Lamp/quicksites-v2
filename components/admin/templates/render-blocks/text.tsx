// components/admin/templates/render-blocks/text.tsx
'use client';

import type { Block } from '@/types/blocks';
import SectionShell from '@/components/ui/section-shell';

type Props = {
  block?: Block;
  content?: Block['content'];
  compact?: boolean;
  colorMode?: 'light' | 'dark';
};

export default function TextRender({
  block,
  content,
  compact = false,
  colorMode = 'light',
}: Props) {
  const c = (content ?? block?.content) as any;

  const html = typeof c?.html === 'string' ? c.html : undefined;
  const text = !html && typeof c?.value === 'string' ? c.value : '';

  const empty = (!html || html.trim() === '') && (!text || text.trim() === '');
  // if (empty) {
  //   return (
  //     <div
  //       className={[
  //         'italic text-sm p-2 rounded',
  //         colorMode === 'dark'
  //           ? 'text-red-300 bg-red-900/30'
  //           : 'text-red-700 bg-red-50',
  //       ].join(' ')}
  //     >
  //       ⚠️ Missing text block content.
  //     </div>
  //   );
  // }

  const size = compact ? 'prose-sm' : 'prose-lg';

  // Darker body text in light mode; keep high contrast in dark mode.
  const tone =
    colorMode === 'dark'
      ? [
          'dark:prose-invert',             // switch to light-on-dark
          'prose-a:text-purple-300',       // link color on dark
        ].join(' ')
      : [
          'prose-p:text-gray-900',         // darker paragraphs
          'prose-li:text-gray-900',        // darker list items
          'prose-strong:text-gray-900',    // strong text
          'prose-headings:text-gray-900',  // headings
          'prose-a:text-purple-700',       // link color on light
        ].join(' ');

  const base = [
    'prose', 'prose-slate', 'max-w-none',
    size,
    'prose-p:leading-relaxed',
    tone,
  ].join(' ');

  return (
    <SectionShell compact={compact}>
      {html ? (
        <div className={base} dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <div className={[base, 'whitespace-pre-line'].join(' ')}>
          {text}
        </div>
      )}
    </SectionShell>
  );
}
