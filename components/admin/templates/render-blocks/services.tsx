// components/admin/templates/render-blocks/services.tsx
'use client';

import type { Block } from '@/types/blocks';
import SectionShell from '@/components/ui/section-shell';

type Props = {
  block?: Block;
  /** legacy content prop is ignored for items now */
  content?: Block['content'];
  compact?: boolean;
  colorMode?: 'light' | 'dark';
  /** preferred: template.services from the DB (jsonb) */
  services?: string[];
  /** optional – some renderers pass the whole template through */
  template?: any;
};

const norm = (v: unknown): string[] =>
  Array.isArray(v)
    ? Array.from(
        new Set(
          v.map((s) => String(s ?? '').trim()).filter(Boolean)
        )
      )
    : [];

export default function ServicesRender({
  block,
  content, // eslint-disable-line @typescript-eslint/no-unused-vars
  compact = false,
  colorMode = 'light',
  services,
  template,
}: Props) {
  // 1) DB column via prop
  const fromDb = norm(services);

  // 2) If parent passed the whole template, try template.services
  const fromTemplate = norm((template as any)?.services);

  // 3) Legacy inline items in the block content
  const fromBlock = norm((block as any)?.content?.items);

  // First non-empty source wins
  const items = fromDb.length ? fromDb : (fromTemplate.length ? fromTemplate : fromBlock);

  if (items.length === 0) {
    return (
      <div className="text-red-500 italic text-sm p-2 bg-red-50 dark:bg-red-900/20 rounded">
        ⚠️ No services configured. This block prefers <code>template.services</code> (DB), and falls back to the block’s own items.
      </div>
    );
  }

  const bgClass = colorMode === 'light' ? 'bg-white' : 'bg-neutral-900';
  const textClass = colorMode === 'light' ? 'text-gray-900' : 'text-white';

  return (
    <SectionShell compact={compact} className={`${bgClass} ${textClass} rounded-lg p-4 glow-card-purple`}>
      <div className="flex justify-center">
        <div className={`flex flex-col items-start text-left w-full max-w-[22rem] sm:max-w-[24rem] pl-10 sm:pl-16 md:pl-0 md:ml-8 ${textClass}`}>
          <h3 className={compact ? 'font-semibold mb-1' : 'text-xl font-semibold mb-3'}>Our Services</h3>
          <ul className={`list-disc list-inside ${items.length > 2 ? 'grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1' : 'space-y-1'}`}>
            {items.map((item, i) => (
              <li key={`${i}-${item}`}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </SectionShell>
  );
}
