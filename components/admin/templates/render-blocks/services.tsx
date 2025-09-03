// components/admin/templates/render-blocks/services.tsx
'use client';

import type { Block } from '@/types/blocks';
import SectionShell from '@/components/ui/section-shell';

type Props = {
  block?: Block;
  content?: Block['content'];
  compact?: boolean;
  colorMode?: 'light' | 'dark';
  services?:
    | string[]
    | Array<{ name?: string; title?: string; description?: string; price?: string | number }>;
  template?: any;
};

function normList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const mapped = v
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object') {
        const o = item as Record<string, any>;
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
  return Array.from(new Set(mapped));
}

export default function ServicesRender({
  block,
  compact = false,
  colorMode,
  services,
  template,
}: Props) {
  const effectiveMode: 'light' | 'dark' =
    colorMode ?? (template?.color_mode === 'dark' ? 'dark' : 'light');

  const fromData = normList((template?.data as any)?.services);
  const fromProp = normList(services as any);
  const fromTemplate = normList((template as any)?.services);
  const fromBlock =
    normList((block as any)?.content?.items) ||
    normList((block as any)?.content?.services);

  const items =
    fromData.length ? fromData :
    fromProp.length ? fromProp :
    fromTemplate.length ? fromTemplate :
    fromBlock;

  const cfg = ((block?.content ?? {}) as any) || {};
  const heading = String(cfg.heading ?? cfg.title ?? '').trim() || 'Our Services';

  const columns: number =
    typeof cfg.columns === 'number' && cfg.columns >= 1 && cfg.columns <= 4
      ? cfg.columns
      : items.length > 6 ? 3
      : items.length > 2 ? 2
      : 1;

  if (items.length === 0) {
    return (
      <div
        className={
          effectiveMode === 'dark'
            ? 'text-red-200 italic text-sm p-2 bg-red-900/20 rounded'
            : 'text-red-700 italic text-sm p-2 bg-red-50 rounded'
        }
      >
        ⚠️ No services configured. This block prefers <code>template.data.services</code>.
      </div>
    );
  }

  // per-theme classes (apply on elements, not the shell)
  const shellBg =
    effectiveMode === 'light'
      ? 'bg-white border border-black/10'
      : 'bg-neutral-900 border border-white/10';
  const headingCls = effectiveMode === 'light' ? 'text-gray-900' : 'text-white';
  const itemTextCls = effectiveMode === 'light' ? 'text-gray-900' : 'text-white';
  const markerCls = effectiveMode === 'light' ? 'marker:text-gray-500' : 'marker:text-gray-300';

  const gridCls =
    columns === 1
      ? 'space-y-1'
      : columns === 2
      ? 'grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1'
      : 'grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-1';

  return (
    <SectionShell
      compact={compact}
      className={`${shellBg} rounded-lg p-4`} // ← no text color here
      aria-label="Services section"
    >
      <div className="mx-auto w-full max-w-4xl">
        <h3 className={`${headingCls} ${compact ? 'font-semibold mb-2 text-lg' : 'text-xl font-semibold mb-4'}`}>
          {heading}
        </h3>
        <ul className={`${gridCls} ${markerCls}`} role="list">
          {items.map((item, i) => (
            <li key={`${i}-${item}`} className={`list-disc list-inside ${itemTextCls}`}>
              {item}
            </li>
          ))}
        </ul>
      </div>
    </SectionShell>
  );
}
