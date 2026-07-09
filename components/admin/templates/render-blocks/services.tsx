// components/admin/templates/render-blocks/services.tsx
'use client';

import type { ReactNode } from 'react';
import type { Block } from '@/types/blocks';
import SectionShell from '@/components/ui/section-shell';
import { resolveSiteLayout } from '@/lib/theme/resolveSiteLayout';

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
  services,
  template,
}: Props) {
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
      <div className="text-destructive italic text-sm p-2 bg-muted rounded">
        ⚠️ No services configured. This block prefers <code>template.data.services</code>.
      </div>
    );
  }

  // Per-block override wins, else the curated theme's featureVariant; null on
  // legacy sites → the classic boxed list.
  const cfgVariant = cfg.variant === 'grid' || cfg.variant === 'cards' || cfg.variant === 'rows' ? cfg.variant : null;
  const variant = cfgVariant ?? resolveSiteLayout(template)?.featureVariant ?? null;

  const colGrid =
    columns >= 3 ? 'sm:grid-cols-2 lg:grid-cols-3'
    : columns === 2 ? 'sm:grid-cols-2'
    : '';

  const headingCls = compact ? 'text-lg font-semibold mb-2' : 'text-2xl font-semibold mb-6';

  // Split a "Name — $price" item back into label + trailing meta for richer variants.
  const parse = (s: string) => {
    const idx = s.indexOf(' — ');
    return idx > -1 ? { label: s.slice(0, idx), meta: s.slice(idx + 3) } : { label: s, meta: '' };
  };

  let inner: ReactNode;
  if (variant === 'cards') {
    // Each service as a card — reads on a banded/muted section.
    inner = (
      <div className={`grid grid-cols-1 gap-4 ${colGrid}`}>
        {items.map((item, i) => {
          const { label, meta } = parse(item);
          return (
            <div key={`${i}-${item}`} className="rounded-lg border border-border bg-card text-card-foreground p-5 shadow-sm">
              <div className="flex items-baseline gap-2">
                <span className="text-primary font-bold">{String(i + 1).padStart(2, '0')}</span>
                <span className="font-semibold">{label}</span>
              </div>
              {meta && <div className="mt-1 text-sm text-muted-foreground">{meta}</div>}
            </div>
          );
        })}
      </div>
    );
  } else if (variant === 'rows') {
    // Editorial: full-width divided rows, roomy.
    inner = (
      <ul className="divide-y divide-border" role="list">
        {items.map((item, i) => {
          const { label, meta } = parse(item);
          return (
            <li key={`${i}-${item}`} className="flex items-baseline justify-between gap-4 py-4">
              <span className="flex items-baseline gap-3 text-lg text-foreground">
                <span className="text-primary font-bold tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                {label}
              </span>
              {meta && <span className="text-muted-foreground shrink-0">{meta}</span>}
            </li>
          );
        })}
      </ul>
    );
  } else if (variant === 'grid') {
    // Themed default: clean marker grid on a transparent (bandable) section.
    inner = (
      <ul className={`grid grid-cols-1 gap-x-8 gap-y-2 ${colGrid}`} role="list">
        {items.map((item, i) => (
          <li key={`${i}-${item}`} className="flex items-baseline gap-2 text-foreground">
            <span className="text-primary" aria-hidden>▹</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    );
  } else {
    // Legacy (no curated theme): the classic boxed list, semantic-token colored.
    return (
      <SectionShell compact={compact} className="bg-card text-card-foreground border border-border rounded-lg p-4" aria-label="Services section">
        <div className="mx-auto w-full max-w-4xl">
          <h3 className={compact ? 'font-semibold mb-2 text-lg' : 'text-xl font-semibold mb-4'}>{heading}</h3>
          <ul
            className={
              columns === 1 ? 'space-y-1'
              : columns === 2 ? 'grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1'
              : 'grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-1'
            }
            role="list"
          >
            {items.map((item, i) => (
              <li key={`${i}-${item}`} className="list-disc list-inside marker:text-muted-foreground">
                {item}
              </li>
            ))}
          </ul>
        </div>
      </SectionShell>
    );
  }

  return (
    <SectionShell compact={compact} className="bg-transparent" aria-label="Services section">
      <div className="mx-auto w-full max-w-4xl">
        <h3 className={`${headingCls} text-foreground`}>{heading}</h3>
        {inner}
      </div>
    </SectionShell>
  );
}
