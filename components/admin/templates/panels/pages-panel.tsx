'use client';

import { useMemo, useState } from 'react';
import Collapsible from '@/components/ui/collapsible-panel';
import { PageManagerSidebar } from '@/components/editor/page-manager-sidebar';
import type { Page, Template } from '@/types/template';

type Props = {
  template: Template;
  onChange: (patch: Partial<Template>) => void; // PARTIAL patch
  selectedIndex: number;
  onSelectPage: (index: number) => void;
};

export default function PagesPanel({
  template,
  onChange,
  selectedIndex,
  onSelectPage,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);

  // Prefer canonical pages; fallback to legacy
  // const pages: Page[] = useMemo(
  //   () =>
  //     (Array.isArray(template.data?.pages) ? template.data!.pages : template.pages) ?? [],
  //   [template.data?.pages, template.pages]
  // );
  const pages = (template?.data as any)?.pages ?? (template as any)?.pages ?? [];
  const handleUpdatePages = (updatedPages: Template['pages']) => {
    onChange({
      ...template,
      pages: updatedPages,                          // legacy
      data: { ...(template.data ?? {}), pages: updatedPages }, // canonical
    });
  };


  const applyPages = (next: Page[]) =>
    onChange({
      pages: next, // legacy mirror
      data: { ...(template.data ?? {}), pages: next }, // canonical
    });

  const clamp = (i: number) =>
    Math.max(0, Math.min(i, Math.max(0, pages.length - 1)));

  return (
    <Collapsible id="pages" title="Pages" defaultOpen>
      <PageManagerSidebar
        pages={pages}
        template={template}
        selectedIndex={clamp(selectedIndex)}
        onSelect={(i) => onSelectPage(clamp(i))}
        onAdd={(newPage: Page, t: Template) => {
          const full: Page = {
            id: newPage.id ?? crypto.randomUUID(),
            slug: newPage.slug ?? `page-${pages.length + 1}`,
            title: newPage.title ?? 'Untitled',
            show_header: newPage.show_header ?? true,
            show_footer: newPage.show_footer ?? true,
            content_blocks: newPage.content_blocks ?? [],
            site_id: t.site_id ?? '',
          };
          applyPages([...pages, full]);
          onSelectPage(pages.length);
        }}
        onRename={(i, title) => {
          const next = pages.map((p: Page, idx: number) => (idx === i ? { ...p, title } : p));
          applyPages(next);
        }}
        onDelete={(i) => {
          const next = pages.filter((p: Page, idx: number) => idx !== i);
          applyPages(next);
          onSelectPage(clamp(i - 1));
        }}
        onReorder={(from, to) => {
          if (from === to) return;
          const next = [...pages];
          const [moved] = next.splice(from, 1);
          next.splice(to, 0, moved);
          applyPages(next);
          onSelectPage(clamp(to));
        }}
        onToggleHeader={(i) => {
          const next = pages.map((p: Page, idx: number) =>
            idx === i ? { ...p, show_header: !p.show_header } : p
          );
          applyPages(next);
        }}
        onToggleFooter={(i) => {
          const next = pages.map((p: Page, idx: number) =>
            idx === i ? { ...p, show_footer: !p.show_footer } : p
          );
          applyPages(next);
        }}
        compact={pages.length > 10}
      />
    </Collapsible>
  );
}
