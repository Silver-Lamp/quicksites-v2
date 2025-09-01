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
  /** preferred: template.data.services (jsonb) or direct prop */
  services?: string[] | Array<{ name?: string; title?: string; description?: string; price?: string | number }>;
  /** optional – some renderers pass the whole template through */
  template?: any;
};

/** Normalize a mixed list (strings or objects) into displayable strings */
function normList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const mapped = v
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object') {
        const o = item as Record<string, any>;
        // prefer name/title; append price if present
        const base = String(o.name ?? o.title ?? '').trim();
        const price =
          o.price != null && String(o.price).trim() !== ''
            ? ` — ${typeof o.price === 'number' ? `$${o.price.toFixed(2)}` : String(o.price)}`
            : '';
        return base ? `${base}${price}` : '';
      }
      return '';
    })
    .map((s) => s.trim())
    .filter(Boolean);
  // de-dupe
  return Array.from(new Set(mapped));
}

export default function ServicesRender({
  block,
  content, // eslint-disable-line @typescript-eslint/no-unused-vars
  compact = false,
  colorMode = 'light',
  services,
  template,
}: Props) {
  const meta = (template?.data as any)?.meta ?? {};

  // 1) Canonical source: template.data.services
  const fromData = normList((template?.data as any)?.services);

  // 2) Explicit prop
  const fromProp = normList(services as any);

  // 3) Optional top-level mirror (for older paths)
  const fromTemplate = normList((template as any)?.services);

  // 4) Legacy inline items in the block content
  const fromBlock =
    normList((block as any)?.content?.items) ||
    normList((block as any)?.content?.services);

  // First non-empty source wins
  const items =
    fromData.length ? fromData
    : fromProp.length ? fromProp
    : fromTemplate.length ? fromTemplate
    : fromBlock;

  const cfg = ((block?.content ?? {}) as any) || {};
  const heading: string = (cfg.heading && String(cfg.heading).trim()) || 'Our Services';
  const columns: number =
    typeof cfg.columns === 'number' && cfg.columns >= 1 && cfg.columns <= 4
      ? cfg.columns
      : items.length > 6
      ? 3
      : items.length > 2
      ? 2
      : 1;

  if (items.length === 0) {
    return (
      <div className="text-red-500 italic text-sm p-2 bg-red-50 dark:bg-red-900/20 rounded">
        ⚠️ No services configured. This block prefers <code>template.data.services</code> and falls
        back to the block’s own items.
      </div>
    );
  }

  const bgClass = colorMode === 'light' ? 'bg-white' : 'bg-neutral-900';
  const textClass = colorMode === 'light' ? 'text-gray-900' : 'text-white';

  // Grid classes by columns
  const gridCls =
    columns === 1
      ? 'space-y-1'
      : columns === 2
      ? 'grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1'
      : 'grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-1';

  return (
    <SectionShell
      compact={compact}
      className={`${bgClass} ${textClass} rounded-lg p-4 glow-card-purple`}
      aria-label="Services section"
    >
      <div className="mx-auto w-full max-w-4xl">
        <h3 className={compact ? 'font-semibold mb-2 text-lg' : 'text-xl font-semibold mb-4'}>
          {heading}
        </h3>
        <ul className={gridCls} role="list">
          {items.map((item, i) => (
            <li key={`${i}-${item}`} className="list-disc list-inside">
              {item}
            </li>
          ))}
        </ul>
      </div>
    </SectionShell>
  );
}
