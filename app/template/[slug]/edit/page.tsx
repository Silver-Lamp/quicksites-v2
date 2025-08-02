// app/template/[slug]/edit/page.tsx
'use client';

import { TemplateEditorProvider } from '@/context/template-editor-context';
import EditWrapper from '@/components/admin/templates/edit-wrapper';

export default function EditPage({ params }: { params: { slug: string } }) {
  return (
    <TemplateEditorProvider templateName={params.slug} colorMode="light">
      <EditWrapper slug={params.slug} />
    </TemplateEditorProvider>
  );
}
