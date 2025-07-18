import { TemplateEditorProvider } from '@/context/template-editor-context';
import TemplateEditorLayout from '@/components/admin/templates/template-editor-layout';
import EditorForm from '@/components/admin/templates/template-editor';
import PreviewPanel from '@/components/admin/templates/template-editor';
import EditorToolbar from '@/components/admin/templates/template-editor';
import { fetchTemplateBySlug } from '@/app/template/\[slug\]/template-loader';
import type { Snapshot } from '@/types/template';

type PageProps = {
  params: { slug: string };
};

export default async function TemplateEditPage({ params }: PageProps) {
  const { slug } = params;

  console.log('[slug]/page.tsx: fetching template with slug:', slug);

  if (!slug || typeof slug !== 'string') {
    console.error('Missing or invalid slug param');
    return <div className="p-6 text-red-500">Invalid template slug.</div>;
  }

  if (slug.endsWith('.js.map')) {
    console.warn(`Blocked attempt to load source map as slug: ${slug}`);
    return <div className="p-6 text-red-500">Invalid template slug.</div>;
  }

  const template = await fetchTemplateBySlug(slug);

  if (!template) {
    console.error(`Template not found for slug: ${slug}`);
    return <div className="p-6 text-red-500">Template not found.</div>;
  }

  return (
    <TemplateEditorProvider
      templateName={template.template_name}
      initialData={template as Snapshot}
    >
      <TemplateEditorLayout
        toolbar={
          <EditorToolbar
            templateName={template.template_name}
            initialData={template as Snapshot}
            onRename={() => {}}
          />
        }
        preview={
          <PreviewPanel
            templateName={template.template_name}
            initialData={template as Snapshot}
            onRename={() => {}}
          />
        }
      >
        <EditorForm
          templateName={template.template_name}
          initialData={template as Snapshot}
          onRename={() => {}}
        />
      </TemplateEditorLayout>
    </TemplateEditorProvider>
  );
}
