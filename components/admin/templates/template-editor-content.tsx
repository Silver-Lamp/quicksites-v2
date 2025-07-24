// components/editor/EditorContent.tsx
'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Button, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui';

import type { Template, TemplateData, Theme } from '@/types/template';
import { saveTemplate } from '@/admin/lib/saveTemplate';
import { saveSite } from '@/admin/lib/saveSite';

import CollapsiblePanel from '@/components/ui/collapsible-panel';
import TemplateSettingsPanel from './template-settings-panel';
import TemplateJsonEditor from './template-json-editor';
import TemplateHistory from './template-history';
import TemplatePreviewWithToggle from './template-preview-with-toggle';
import TemplatePublishModal from './template-publish-modal';
import { TemplateActionToolbar } from './template-action-toolbar';
import { IndustryThemeScope } from '@/components/ui/industry-theme-scope';
import { BlockValidationError, validateTemplateBlocks } from '@/hooks/validateTemplateBlocks';
import { TemplateSaveSchema } from '@/admin/lib/zod/templateSaveSchema';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@/types/supabase';
import { usePanelControls } from '@/components/ui/panel-context';
import { EditorContentOverlay } from '@/components/editor/editor-content-overlay';
import DevicePreviewWrapper from '@/components/admin/templates/device-preview-wrapper';
import { LiveEditorPreview } from '@/components/editor/live-editor-preview';
import ThemeScope from '@/components/ui/theme-scope';

function pushWithLimit<T>(stack: T[], item: T, limit = 10): T[] {
  return [...stack.slice(-limit + 1), item];
}

export function EditorContent({
  template,
  rawJson,
  setRawJson,
  livePreviewData,
  setTemplate,
  autosaveStatus,
  setShowPublishModal,
  recentlyInsertedBlockId,
  setBlockErrors,
  blockErrors,
  mode,
}: {
  template: Template;
  rawJson: string;
  setRawJson: (v: string) => void;
  livePreviewData: TemplateData;
  setTemplate: React.Dispatch<React.SetStateAction<Template>>;
  autosaveStatus: string;
  setShowPublishModal: (v: boolean) => void;
  recentlyInsertedBlockId: string | null;
  setBlockErrors: (errors: Record<string, BlockValidationError[]>) => void;
  blockErrors: Record<string, BlockValidationError[]> | null;
  mode: 'template' | 'site';
}) {
  const supabase = createClientComponentClient<Database>();

  const handleTemplateChange = (updated: Template) => {
    setHistoryStack((prev) => pushWithLimit(prev, template, 10));
    setRedoStack([]);
    setTemplate(updated);
    setRawJson(JSON.stringify(updated.data, null, 2));
    setTemplateErrors({});
    setFormErrors([]);

    const updatedBlockIds = new Set(
      updated.data.pages.flatMap((page) => page.content_blocks.map((b) => b._id))
    );
    const prevErrors = blockErrors || {};
    const filtered: Record<string, BlockValidationError[]> = {};
    for (const id in prevErrors) {
      if (updatedBlockIds.has(id)) filtered[id] = prevErrors[id];
    }
    setBlockErrors(filtered);
  };

  const [templateErrors, setTemplateErrors] = useState<Record<string, string[]>>({});
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [showModal, setModal] = useState(false);
  const [historyStack, setHistoryStack] = useState<Template[]>(() => {
    const stored = localStorage.getItem('templateHistory');
    return stored ? JSON.parse(stored) : [];
  });
  const [redoStack, setRedoStack] = useState<Template[]>(() => {
    const stored = localStorage.getItem('templateRedo');
    return stored ? JSON.parse(stored) : [];
  });

  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('preview-theme');
      if (stored === 'dark') return true;
      if (stored === 'light') return false;
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return true;
  });

  useEffect(() => {
    localStorage.setItem('preview-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const handleUndo = () => {
    if (historyStack.length === 0) {
      toast('Nothing to undo');
      return;
    }
    const previous = historyStack[historyStack.length - 1];
    setHistoryStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => pushWithLimit(prev, template, 10));
    setTemplate(previous);
    setRawJson(JSON.stringify(previous.data, null, 2));
    toast.success('Undo successful');
  };

  const handleRedo = () => {
    if (redoStack.length === 0) {
      toast('Nothing to redo');
      return;
    }
    const next = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    setHistoryStack((prev) => pushWithLimit(prev, template, 10));
    setTemplate(next);
    setRawJson(JSON.stringify(next.data, null, 2));
    toast.success('Redo successful');
  };

  const handleSaveDraft = async () => {
    try {
      const parsed = JSON.parse(rawJson);
      const full = { ...template, data: parsed };
      const { isValid, errors } = validateTemplateBlocks(full);
      const result = TemplateSaveSchema.safeParse(full);
      const fieldErrors = result.success ? {} : result.error.flatten().fieldErrors;
      const formErrors = result.success ? [] : result.error.flatten().formErrors;

      setTemplateErrors(fieldErrors);
      setFormErrors(formErrors);
      setBlockErrors(errors);

      if (!result.success || Object.keys(errors).length > 0) {
        toast.error('Validation failed. Fix errors to save.');
        return;
      }

      const promise = (mode === 'template' ? saveTemplate : saveSite)(full);
      toast.promise(promise, {
        loading: 'Saving...',
        success: 'Template saved!',
        error: 'Failed to save',
      });

      const saved = await promise;
      setTemplate(saved);
      setRawJson(JSON.stringify(saved.data, null, 2));
      setBlockErrors({});
    } catch (err: any) {
      toast.error('Invalid JSON');
    }
  };

  return (
    <IndustryThemeScope industry={template.industry}>
      {(formErrors.length > 0 || Object.keys(templateErrors).length > 0) && (
        <div className="p-4 bg-red-100 border border-red-300 text-red-800 rounded-md mb-4 max-w-3xl mx-auto">
          <h4 className="font-semibold mb-2">Validation Issues</h4>

          {formErrors.length > 0 && (
            <ul className="list-disc ml-6 mb-2">
              {formErrors.map((err, idx) => (
                <li key={`form-error-${idx}`}>{err}</li>
              ))}
            </ul>
          )}

          {Object.entries(templateErrors).map(([field, errors]) => (
            <div key={field} className="mb-2">
              <div className="font-medium">{field}:</div>
              <ul className="list-disc ml-6">
                {errors.map((err, idx) => (
                  <li key={`${field}-error-${idx}`}>{err}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <Tabs defaultValue="preview">
        <TabsList>
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="settings">
          <TemplateSettingsPanel template={template} onChange={handleTemplateChange} /> 
          {/* <EditorContentOverlay
            template={template}
            rawJson={rawJson}
            setRawJson={setRawJson}
            onChange={handleTemplateChange}
          /> */}
        </TabsContent>

        <TabsContent value="preview">
          <div className="relative md:ml-64 transition-all duration-300">
            <ThemeScope mode={template.theme === 'light' ? 'light' : 'dark'}>
              <DevicePreviewWrapper theme={template.theme as Theme}>
                <IndustryThemeScope industry={template.industry}>
                  <LiveEditorPreview
                    template={template}
                    onChange={handleTemplateChange}
                    industry={template.industry}
                    errors={blockErrors ?? {}}
                  />
                </IndustryThemeScope>
              </DevicePreviewWrapper>
            </ThemeScope>
          </div>
        </TabsContent>


        <TabsContent value="history">
          <TemplateHistory template={template} onRevert={handleTemplateChange} />
        </TabsContent>
      </Tabs>

      <TemplateJsonEditor
        rawJson={rawJson}
        setRawJson={setRawJson}
      />

      <TemplatePublishModal
        open={showModal}
        onClose={() => setModal(false)}
        snapshotId={template.id || ''}
      />

      <TemplateActionToolbar
        template={template}
        autosaveStatus={autosaveStatus}
        onSaveDraft={handleSaveDraft}
        onUndo={handleUndo}
        onRedo={handleRedo}
      />
    </IndustryThemeScope>
  );
}
