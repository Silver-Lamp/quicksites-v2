// components/admin/templates/render-blocks/services.tsx
'use client';

import { isEditorContext } from '@/lib/editor/isEditorContext';

import type { ReactNode } from 'react';
import type { Block } from '@/types/blocks';
import SectionShell from '@/components/ui/section-shell';
import { isPersonTemplate } from '@/lib/sites/personSite';
import { groupSkills, shouldGroupSkills } from '@/lib/sites/skillGroups';
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

  /**
   * ⚠️ ONE ITEM IS NOT A LIST, AND NUMBERING IT MAKES THE PAGE LOOK BROKEN.
   *
   * A listing import derives services from the business's Google categories, which for most
   * non-food businesses is exactly one. Every auto-shop draft rendered:
   *
   *     Our Services
   *     01   Car Repair
   *
   * …on a business named "La Tranca Auto Repair". The "01" promises a 02 that never comes, and the
   * plural heading promises a list of one. It reads as a rendering bug, which costs more trust than
   * the line earns — the first thing an owner sees is a page that looks half-built.
   *
   * So a single service drops the ordinal and the plural. The CONTENT is untouched: a lone
   * "Transmission Shop" is genuinely more specific than "auto repair" and is still worth showing.
   * This is presentation only, and it fixes every existing draft with no backfill.
   */
  const singleService = items.length === 1;
  const heading =
    String(cfg.heading ?? cfg.title ?? '').trim() || (singleService ? 'What we do' : 'Our Services');

  // ⚠️ ON A PERSON'S SITE THIS BLOCK IS A SKILLS LIST, NOT A SERVICE MENU. Forty numbered bullets
  // is a wall nobody reads top-to-bottom; grouped chips are scannable in about three seconds.
  // Grouping is presentation only — every skill still appears, in the owner's own words and their
  // own order (lib/sites/skillGroups.ts asserts nothing is lost).
  const personSite = isPersonTemplate((template as any)?.data ?? template);
  if (personSite && shouldGroupSkills(items.length)) {
    const groups = groupSkills(items);
    return (
      <SectionShell compact={compact} className="bg-transparent" aria-label="Skills section">
        <div className="mx-auto w-full max-w-4xl">
          <h3 className="text-xl font-semibold mb-6 text-foreground">{heading}</h3>
          <div className="space-y-5">
            {groups.map((g) => (
              <div key={g.label}>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {g.label}
                </h4>
                <ul className="flex flex-wrap gap-2" role="list">
                  {g.skills.map((skill, i) => (
                    <li
                      key={`${g.label}-${i}-${skill}`}
                      className="rounded-full border border-border bg-muted px-3 py-1 text-sm text-foreground"
                    >
                      {skill}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </SectionShell>
    );
  }

  const columns: number =
    typeof cfg.columns === 'number' && cfg.columns >= 1 && cfg.columns <= 4
      ? cfg.columns
      : items.length > 6 ? 3
      : items.length > 2 ? 2
      : 1;

  if (items.length === 0) {
    // ⚠️ EDITOR ONLY. This warning names an internal data path (`template.data.services`), and
    // it was rendering on PUBLISHED pages — a red error message quoting our own schema at a
    // business's customers. An empty services block now renders nothing at all in public, which
    // is the same rule a missing backdrop and a dropped invalid block already follow.
    if (!isEditorContext()) return null;
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
                {!singleService && (
                  <span className="text-primary font-bold">{String(i + 1).padStart(2, '0')}</span>
                )}
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
                {!singleService && (
                  <span className="text-primary font-bold tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                )}
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
