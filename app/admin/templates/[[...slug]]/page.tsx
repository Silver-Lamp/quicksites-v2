import { notFound } from 'next/navigation';
import { fetchTemplateBySlug } from '@/app/template/[slug]/template-loader';
import type { Snapshot } from '@/types/template';
import { TemplateEditorProvider } from '@/context/template-editor-context';
import TemplateEditorLayout from '@/components/admin/templates/template-editor-layout';
import EditorForm from '@/components/admin/templates/template-editor';
import PreviewPanel from '@/components/admin/templates/template-editor';
import EditorToolbar from '@/components/admin/templates/template-editor';

type PageProps = {
  params: { slug: string };
};

export default async function TemplateEditPage({ params }: PageProps) {
  const slug = params.slug;

  const isStaticAsset = /\.(?:js\.map|json|txt|xml|svg|ico|png|jpg|jpeg|webp|woff2?)$/i.test(slug);

  if (!slug || typeof slug !== 'string' || isStaticAsset) {
    console.warn('Blocked static asset slug:', slug);
    notFound();
  }

  const template = await fetchTemplateBySlug(slug);
  if (!template) notFound();

  return (
    <TemplateEditorProvider
      templateName={template.template_name}
      initialData={template as unknown as Snapshot}
      colorMode="dark"
    >
      <TemplateEditorLayout
        toolbar={
          <EditorToolbar
            templateName={template.template_name}
            initialData={template as unknown as Snapshot}
            onRename={() => {}}
          />
        }
        preview={
          <PreviewPanel
            templateName={template.template_name}
            initialData={template as unknown as Snapshot}
            onRename={() => {}}
          />
        }
      >
        <EditorForm
          templateName={template.template_name}
          initialData={template as unknown as Snapshot}
          onRename={() => {}}
        />
      </TemplateEditorLayout>
    </TemplateEditorProvider>
  );
}
