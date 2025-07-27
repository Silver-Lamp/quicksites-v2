'use client';

import { useState } from 'react';
import Collapsible from '@/components/ui/collapsible-panel';
import { PageManagerSidebar } from '@/components/editor/page-manager-sidebar';
import type { Page, Template } from '@/types/template';

export default function PagesPanel({
  template,
  onChange,
}: {
  template: Template;
  onChange: (updated: Template) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  const pages = template?.data?.pages || [];
  const selectedIndex = 0; // you can wire this up to state if needed

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
    <Collapsible
      id="pages"
      title="Pages"
      defaultOpen
    //   onToggle={() => setCollapsed(!collapsed)}
    >
      <PageManagerSidebar
        pages={pages}
        selectedIndex={selectedIndex}
        onSelect={(index) => {
          console.log('Selected page:', pages[index]);
        }}
        onAdd={(newPage: Page) => {
            console.log('Adding page:', newPage);
            handleUpdatePages([...pages, newPage]);
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
