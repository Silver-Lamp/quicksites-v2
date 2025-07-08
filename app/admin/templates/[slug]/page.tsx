// app/admin/templates/[slug]/page.tsx
import { TemplateEditorProvider } from '@/context/template-editor-context';
import TemplateEditorLayout from '@/components/admin/templates/template-editor-layout';
import EditorForm from '@/components/admin/templates/template-editor';
import PreviewPanel from '@/components/admin/templates/template-editor';
import EditorToolbar from '@/components/admin/templates/template-editor';
import { fetchTemplateBySlug } from '@/app/edit/[slug]/template-loader';
import type { Snapshot, Template } from '@/types/template';
// import { useAutosaveTemplate } from '@/hooks/useAutosaveTemplate';

export default async function TemplateEditPage({ params }: { params: { slug: string } }) {
  const template = await fetchTemplateBySlug(params.slug);

//   const autosave = useAutosaveTemplate(template, JSON.stringify(template.data, null, 2));


  if (!template) {
    return <div className="p-6 text-red-500">Template not found.</div>;
  }
//   return (
//     <span className="text-xs">
//       {autosave.status === 'saving' ? 'Saving…' : 'Saved'}
//     </span>
//   );
  return (
    <TemplateEditorProvider templateName={template.template_name} initialData={template as Snapshot}>
      <TemplateEditorLayout 
        toolbar={<EditorToolbar templateName={template.template_name} initialData={template as Snapshot} onRename={() => {}} />} 
        preview={<PreviewPanel templateName={template.template_name} initialData={template as Snapshot} onRename={() => {}} />
    }>
      <EditorForm templateName={template.template_name} initialData={template as Snapshot} onRename={() => {}} />
      </TemplateEditorLayout>
    </TemplateEditorProvider>
  );
}
