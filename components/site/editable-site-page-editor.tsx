// components/site/editable-site-page-editor.tsx
'use client';

import TemplatePageEditor from '@/components/admin/templates/template-page-editor';
import type { Page } from '@/types/site';
import type { Template } from '@/types/template';
import { nanoid } from 'nanoid';

export default function EditableSitePageEditor({
//   pages,
  data,
  onChange,
}: {
//   pages: Page[];
    data: Template['data'] | Page[];
  onChange: (updated: Template['data'] | Page[]) => void;
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
    data: data as Template['data'],
  };

  return (
    <TemplatePageEditor
      template={mockTemplate}
      onChange={(updatedTemplate) => {
        onChange(updatedTemplate as Template['data'] | Page[]);
      }}
      onLivePreviewUpdate={() => {}}
      blockErrors={{}}
    />
  );
}
