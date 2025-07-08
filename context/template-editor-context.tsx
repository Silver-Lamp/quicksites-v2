// context/template-editor-context.tsx
'use client';

import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { useTemplateEditorState } from '@/components/admin/templates/use-template-editor-state';
import type { Snapshot } from '@/types/template';

const TemplateEditorContext = createContext<ReturnType<typeof useTemplateEditorState> | null>(null);

export function TemplateEditorProvider({
  templateName,
  initialData,
  onRename,
  children,
}: {
  templateName: string;
  initialData?: Snapshot;
  onRename?: (name: string) => void;
  children: ReactNode;
}) {
  const editor = useTemplateEditorState({ templateName, initialData, onRename });

  return (
    <TemplateEditorContext.Provider value={editor}>
      {children}
    </TemplateEditorContext.Provider>
  );
}

export function useTemplateEditor() {
  const ctx = useContext(TemplateEditorContext);
  if (!ctx) throw new Error('useTemplateEditor must be used within TemplateEditorProvider');
  return ctx;
}
