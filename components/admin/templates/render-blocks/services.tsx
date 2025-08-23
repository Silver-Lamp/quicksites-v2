// File: components/admin/templates/render-blocks/services.tsx
'use client';

import type { Block } from '@/types/blocks';
import SectionShell from '@/components/ui/section-shell';

type Props = {
  block?: Block;
  /** legacy content prop is ignored for items now */
  content?: Block['content'];
  compact?: boolean;
  colorMode?: 'light' | 'dark';
  /** <-- pass template.services from the DB */
  services?: string[];
};

export default function ServicesRender({
  block,
  content, // eslint-disable-line @typescript-eslint/no-unused-vars
  compact = false,
  colorMode = 'light',
  services = [],
}: Props) {
  // Read ONLY from DB-provided services
  const items = (services ?? [])
    .map((s) => (s ?? '').toString().trim())
    .filter(Boolean);

  if (items.length === 0) {
    return (
      <div className="text-red-500 italic text-sm p-2 bg-red-50 dark:bg-red-900/20 rounded">
        ⚠️ No services configured. This block reads from <code>template.services</code>.
      </div>
    );
  }

  const bgClass = colorMode === 'light' ? 'bg-white' : 'bg-neutral-900';
  const textClass = colorMode === 'light' ? 'text-gray-900' : 'text-white';

  return (
    <SectionShell
      compact={compact}
      className={`${bgClass} ${textClass} rounded-lg p-4 glow-card-purple`}
    >
      <div className="flex justify-center">
        <div
          className={`flex flex-col items-start text-left w-full max-w-[22rem] sm:max-w-[24rem] pl-10 sm:pl-16 md:pl-0 md:ml-8 ${textClass}`}
        >
          <h3 className={compact ? 'font-semibold mb-1' : 'text-xl font-semibold mb-3'}>
            Our Services
          </h3>
          <ul
            className={`list-disc list-inside ${
              items.length > 2
                ? 'grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1'
                : 'space-y-1'
            }`}
          >
            {items.map((item, i) => (
              <li key={`${i}-${item}`}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </SectionShell>
  );
}
