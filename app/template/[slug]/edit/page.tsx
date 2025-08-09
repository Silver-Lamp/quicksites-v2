'use client';

import { use } from 'react';
import { TemplateEditorProvider } from '@/context/template-editor-context';
import EditWrapper from '@/components/admin/templates/edit-wrapper';
import AdminLayout from '@/app/admin/layout';

export default function EditPage(promiseParams: { params: Promise<{ slug: string }> }) {
  const { slug } = use(promiseParams.params);

  return (
    <AdminLayout>
      <TemplateEditorProvider templateName={slug} colorMode="light">
        <EditWrapper slug={slug} />
      </TemplateEditorProvider>
    </AdminLayout>
  );
}
