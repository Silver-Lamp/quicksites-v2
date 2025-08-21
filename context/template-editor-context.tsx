// context/template-editor-context.tsx
'use client';

import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { useTemplateEditorState } from '@/components/admin/templates/use-template-editor-state';
import type { Snapshot } from '@/types/template';

const TemplateEditorContext = createContext<ReturnType<typeof useTemplateEditorState> & { colorMode: 'light' | 'dark' } | null>(null);

export function TemplateEditorProvider({
  templateName,
  initialData,
  onRename,
  children,
  colorMode,
}: {
  templateName: string;
  initialData?: Snapshot;
  onRename?: (name: string) => void;
  children: ReactNode;
  colorMode: 'light' | 'dark';
}) {
  const editor = useTemplateEditorState({ templateName, initialData, onRename, colorMode, mode: 'template' });

  return (
    <TemplateEditorContext.Provider value={{ ...editor, colorMode: colorMode as 'light' | 'dark' }}>
      {children}
    </TemplateEditorContext.Provider>
  );
}

export function useTemplateEditor() {
  const ctx = useContext(TemplateEditorContext);
  if (!ctx) throw new Error('useTemplateEditor must be used within TemplateEditorProvider');
  return ctx;
}
