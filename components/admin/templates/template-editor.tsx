// components/admin/templates/template-editor.tsx
"use client";

import { useRouter } from 'next/navigation';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TemplateEditorToolbar } from './template-editor-toolbar';
import { useTemplateEditorState } from './use-template-editor-state';
import { TemplateEditorContent } from './template-editor-content';
import type { Snapshot, Template } from '@/types/template';
import { Dispatch, SetStateAction } from 'react';

export default function TemplateEditor({
  templateName,
  initialData,
  onRename,
}: {
  templateName: string;
  initialData?: Snapshot;
  onRename?: (newName: string) => void;
}) {
  const router = useRouter();
  const {
    template,
    rawJson,
    setRawJson,
    livePreviewData,
    setTemplate,
    autosave,
    isCreating,
    isRenaming,
    setIsRenaming,
    handleRename,
    inputValue,
    setInputValue,
    slugPreview,
    handleSaveDraft,
    nameExists,
    // setShowNameError,
  } = useTemplateEditorState({ templateName, initialData, onRename });

  // if (isCreating) {
  //   return (
  //     <div className="p-6 text-muted-foreground text-sm italic">
  //       Saving and redirecting...
  //     </div>
  //   );
  // }

  // if (!template.id) {
  //   return (
  //     <div className="p-6 text-muted-foreground text-sm italic">
  //       Creating new template...
  //     </div>
  //   );
  // }

  return (
    <ScrollArea className="h-screen w-full p-6">
      <TemplateEditorToolbar
        templateName={template.name}
        autosaveStatus={autosave.status}
        isRenaming={isRenaming}
        setIsRenaming={setIsRenaming}
        inputValue={inputValue}
        setInputValue={setInputValue}
        slugPreview={slugPreview}
        handleRename={handleRename}
        handleSaveDraft={handleSaveDraft}
        onBack={() => router.push('/admin/templates')}
        nameExists={nameExists}
        setShowNameError={() => {}} />
      <TemplateEditorContent
        template={template as Template}
        rawJson={rawJson}
        setRawJson={setRawJson}
        livePreviewData={livePreviewData}
        setTemplate={setTemplate as Dispatch<SetStateAction<Template>>}
        autosaveStatus={autosave.status}
        setShowPublishModal={() => {}}
      />
    </ScrollArea>
  );
}
