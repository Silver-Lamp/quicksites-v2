'use client';

import { useState } from 'react';
import Collapsible from '@/components/ui/collapsible-panel';
import { PageManagerSidebar } from '@/components/editor/page-manager-sidebar';
import type { Page, Template } from '@/types/template';

export default function PagesPanel({
  template,
  onChange,
  selectedIndex,
  onSelectPage,
}: {
  template: Template;
  onChange: (updated: Template) => void;
  selectedIndex: number;
  onSelectPage: (index: number) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  const pages = template?.data?.pages || [];

  const handleUpdatePages = (updatedPages: Template['data']['pages']) => {
    onChange({
      ...template,
      data: {
        ...template.data,
        pages: updatedPages,
      },
    });
  };

  return (
    <Collapsible id="pages" title="Pages" defaultOpen>
      <PageManagerSidebar
        pages={pages}
        selectedIndex={selectedIndex}
        onSelect={(index) => onSelectPage(index)}
        onAdd={(newPage: Page) => {
          const fullPage: Page = {
            ...newPage,
            site_id: template.site_id || '',
          };
          handleUpdatePages([...pages, fullPage]);
        }}
        onRename={(index, newTitle) => {
          const updated = [...pages];
          updated[index].title = newTitle;
          handleUpdatePages(updated);
        }}
        onDelete={(index) => {
          const updated = [...pages];
          updated.splice(index, 1);
          handleUpdatePages(updated);
        }}
        onReorder={(from, to) => {
          const updated = [...pages];
          const [moved] = updated.splice(from, 1);
          updated.splice(to, 0, moved);
          handleUpdatePages(updated);
        }}
        onToggleHeader={(index) => {
          const updated = [...pages];
          updated[index].show_header = !updated[index].show_header;
          handleUpdatePages(updated);
        }}
        onToggleFooter={(index) => {
          const updated = [...pages];
          updated[index].show_footer = !updated[index].show_footer;
          handleUpdatePages(updated);
        }}
        compact={pages.length > 10}
        templateShowHeader={template.show_header}
        templateShowFooter={template.show_footer}
      />
    </Collapsible>
  );
}
