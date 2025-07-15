// components/site/editable-site-page-editor.tsx
'use client';

import PageEditor from '@/components/admin/templates/template-page-editor';
import type { Page } from '@/types/site';
import type { Template } from '@/types/template';
import { nanoid } from 'nanoid';

export default function EditableSitePageEditor({
  pages,
  onChange,
}: {
  pages: Page[];
  onChange: (updated: Page[]) => void;
}) {
  const mockTemplate: Template = {
    id: 'site-editor-template',
    template_name: 'Live Site Editor',
    slug: 'site-editor',
    industry: 'custom',
    layout: 'default',
    brand: '',
    theme: 'light',
    color_scheme: 'gray',
    data: {
      pages: pages as Template['data']['pages'],
    },
  };

  return (
    <PageEditor
      template={mockTemplate}
      onChange={(updatedTemplate) => {
        onChange(updatedTemplate.data.pages as Page[]);
      }}
      onLivePreviewUpdate={() => {}}
      blockErrors={{}}
    />
  );
}
