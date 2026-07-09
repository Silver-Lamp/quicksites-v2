// components/admin/templates/render-blocks/section.tsx
'use client';

// Multi-column section: renders each column's child blocks side-by-side on desktop
// and stacked on mobile. Columns size by their `span` (fr units). Transparent
// wrapper so the page/banded background + theme show through; children are ordinary
// blocks (theme-token styled) rendered via RenderBlock. The nesting foundation for
// L4 (docs/LAYOUT_L4_PLAN.md).

import RenderBlock from '../render-block';
import { normalizeBlock } from '@/lib/utils/normalizeBlock';

type Col = { span?: number; items?: any[] };

const GAP: Record<string, string> = { sm: 'gap-4', md: 'gap-8', lg: 'gap-12' };
const ALIGN: Record<string, string> = { start: 'items-start', center: 'items-center', stretch: 'items-stretch' };

function pickContent(block: any, override: any) {
  return (override ?? block?.content ?? block?.props ?? {}) as any;
}

export default function SectionRender(props: any) {
  const { block, content, template, colorMode, previewOnly, device } = props ?? {};
  const c = pickContent(block, content);

  const columns: Col[] = (Array.isArray(c.columns) ? c.columns : []).filter(
    (col: any) => col && Array.isArray(col.items),
  );
  if (!columns.length) return null;

  const gapCls = GAP[c.gap] ?? GAP.md;
  const alignCls = ALIGN[c.align] ?? ALIGN.stretch;
  const reverse = c.reverseOnMobile ? 'flex-col-reverse' : 'flex-col';
  // Desktop column proportions from spans (fr units) via a CSS var so it can be
  // responsive (mobile = single column, md+ = the fr template).
  const cols = columns.map((col) => `${col.span && col.span > 0 ? col.span : 1}fr`).join(' ');

  return (
    <section className="w-full px-4 py-10 md:px-6 lg:px-8">
      {c.title ? (
        <h2 className="mx-auto mb-6 max-w-6xl text-2xl font-bold tracking-tight text-foreground">{c.title}</h2>
      ) : null}
      <div
        className={`mx-auto flex max-w-6xl ${reverse} md:grid md:[grid-template-columns:var(--qs-cols)] ${gapCls} ${alignCls}`}
        style={{ ['--qs-cols' as any]: cols }}
      >
        {columns.map((col, i) => {
          const items = (Array.isArray(col.items) ? col.items : []).map((b: any) => normalizeBlock(b));
          return (
            <div key={i} className="min-w-0">
              {items.map((b: any, j: number) => (
                <RenderBlock
                  key={b?._id ?? b?.id ?? j}
                  block={b}
                  template={template}
                  colorMode={colorMode}
                  previewOnly={previewOnly}
                  device={device}
                  showDebug={false}
                />
              ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}
