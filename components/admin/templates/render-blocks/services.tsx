'use client';

import type { Block } from '@/types/blocks';
import SectionShell from '@/components/ui/section-shell';

type ServicesBlock = Extract<Block, { type: 'services' }>;

type Props = {
  block?: ServicesBlock;
  content?: ServicesBlock['content'];
  compact?: boolean;
};

export default function ServicesRender({ block, content, compact = false }: Props) {
  const final = content || block?.content;

  if (!final || !final.items?.length) {
    return (
      <div className="text-red-500 italic text-sm p-2 bg-red-50 dark:bg-red-900/20 rounded">
        ⚠️ Missing services block content.
      </div>
    );
  }

  return (
    <SectionShell
      compact={compact}
      bg={!compact ? 'bg-white text-gray-900 dark:bg-neutral-900 dark:text-white rounded-lg p-4 glow-card-purple' : ''}
    >
      <div className="flex justify-center">
        <div className="flex flex-col items-start text-left w-full max-w-[22rem] sm:max-w-[24rem] pl-10 sm:pl-16 md:pl-0 md:ml-8">
          <h3 className={compact ? 'font-semibold mb-1' : 'text-xl font-semibold mb-3'}>
            Our Services
          </h3>
          <ul
            className={`list-disc list-inside gap-x-8 ${
              final.items.length > 2
                ? 'grid grid-cols-1 md:grid-cols-2 gap-y-1'
                : 'space-y-1'
            }`}
          >
            {final.items.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </SectionShell>
  );
}
