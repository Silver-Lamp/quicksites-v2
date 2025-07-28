'use client';

import type { Block } from '@/types/blocks';
import SectionShell from '@/components/ui/section-shell';

type Props = {
  block?: Block;
  content?: Block['content'];
  compact?: boolean;
};

export default function FaqRender({ block, content, compact = false }: Props) {
  const final = content || block?.content || { items: [] };

  if (!final || !final.items?.length) {
    return (
      <div className="text-red-500 italic text-sm p-2 bg-red-50 dark:bg-red-900/20 rounded">
        ⚠️ Missing FAQ block content.
      </div>
    );
  }

  return (
    <SectionShell
      compact={compact}
      bg={!compact ? 'bg-white text-gray-900 dark:bg-neutral-900 dark:text-white rounded-lg p-4 glow-card-purple' : ''}
    >
      <div className="flex justify-center">
        <div className="flex flex-col items-start text-left w-full max-w-2xl pl-6 sm:pl-12 md:pl-0 md:ml-8">
          <h3 className={compact ? 'font-semibold mb-1' : 'text-xl font-semibold mb-4'}>
            {final.title || 'Frequently Asked Questions'}
          </h3>
          <hr className="my-4" />
          <dl className="space-y-4">
            {final.items.map((item: { question: string; answer: string }, i: number) => (
              <div key={i}>
                <dt className="font-semibold">{item.question}</dt>
                <dd className="ml-4 mt-1 text-sm text-white/80">{item.answer}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </SectionShell>
  );
}
