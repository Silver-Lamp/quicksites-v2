'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Button, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui';

import type { Template, TemplateData, Theme } from '@/types/template';
import { saveTemplate } from '@/admin/lib/saveTemplate';
import { saveSite } from '@/admin/lib/saveSite';

import SidebarSettings from '../template-settings-panel/sidebar-settings';
import TemplateJsonEditor from './template-json-editor';
import TemplateHistory from './template-history';
import TemplatePublishModal from './template-publish-modal';
import { TemplateActionToolbar } from './template-action-toolbar';
import { IndustryThemeScope } from '@/components/ui/industry-theme-scope';
import { BlockValidationError, validateTemplateBlocks } from '@/hooks/validateTemplateBlocks';
import { TemplateSaveSchema } from '@/admin/lib/zod/templateSaveSchema';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@/types/supabase';
import ThemeScope from '@/components/ui/theme-scope';
import { normalizeTemplate } from '@/admin/utils/normalizeTemplate';
import { printZodErrors } from '@/admin/lib/printZodErrors';
import { ZodError } from 'zod';
import DevValidatorPanel from '../dev-validator-panel';
import DevicePreviewWrapper from '@/components/admin/templates/device-preview-wrapper';
import { LiveEditorPreview } from '@/components/editor/live-editor-preview';

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

  const [zodError, setZodError] = useState<ZodError | null>(null);
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
  const [sidebarValues, setSidebarValues] = useState<{
    template_name?: string;
    slug?: string;
    industry?: string;
  }>({
    template_name: template.template_name,
    slug: template.slug,
    industry: template.industry,
  });

  // Resizable + responsive sidebar
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 768);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const handleTemplateChange = (updated: Template) => {
    setHistoryStack((prev) => pushWithLimit(prev, template, 10));
    setRedoStack([]);
    setTemplate(updated);
    setRawJson(JSON.stringify(updated, null, 2));
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

  const handleUndo = () => {
    if (historyStack.length === 0) return toast('Nothing to undo');
    const previous = historyStack[historyStack.length - 1];
    setHistoryStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => pushWithLimit(prev, template, 10));
    setTemplate(previous);
    setRawJson(JSON.stringify(previous, null, 2));
    toast.success('Undo successful');
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return toast('Nothing to redo');
    const next = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    setHistoryStack((prev) => pushWithLimit(prev, template, 10));
    setTemplate(next);
    setRawJson(JSON.stringify(next, null, 2));
    toast.success('Redo successful');
  };

  const handleSaveDraft = async () => {
    try {
      const parsed = JSON.parse(rawJson);
      const full = normalizeTemplate(parsed);

      const { errors: blockErrors } = validateTemplateBlocks(full);
      setBlockErrors(blockErrors);

      const result = TemplateSaveSchema.safeParse(full);

      if (!result.success || Object.keys(blockErrors).length > 0) {
        printZodErrors(result.error as ZodError, '❌ Template Validation Failed');
        setZodError(result.error ?? null);
        const flat = result.error?.flatten();
        const firstField = Object.keys(flat?.fieldErrors ?? {})[0];
        const firstError = flat?.fieldErrors?.[firstField as keyof typeof flat.fieldErrors]?.[0];
        setTemplateErrors(flat?.fieldErrors ?? {});
        setFormErrors(flat?.formErrors ?? []);
        toast.error(firstError || 'Template validation failed. Fix errors to save.');
        return;
      }

      const { services, ...safeToSave } = full;
      const promise = (mode === 'template' ? saveTemplate : saveSite)(safeToSave);
      toast.promise(promise, {
        loading: 'Saving...',
        success: 'Template saved!',
        error: 'Failed to save',
      });

      const saved = await promise;
      setTemplate(saved);
      setRawJson(JSON.stringify(saved, null, 2));
      setBlockErrors({});
      setZodError(null);
    } catch (err: any) {
      console.error('Invalid JSON (template-editor-content.tsx):', err);
      toast.error('Invalid JSON. Fix formatting and try again.');
    }
  };

  return (
    <IndustryThemeScope industry={template.industry}>
      <Tabs defaultValue="preview">
        <TabsList>
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="preview">
          <div className="flex h-full">
            {/* Sidebar */}
            <div
              className={`relative shrink-0 border-r border-white/10 bg-black transition-all duration-300 ${
                isMobile ? 'w-0 opacity-0' : 'opacity-100'
              }`}
              style={{ width: isMobile ? 0 : sidebarWidth }}
            >
              {!isMobile && (
                <div className="sticky top-0 h-screen overflow-y-auto flex flex-col">
                  {/* Logo Bar */}
                  <div className="px-4 py-3 border-b border-white/10">
                    <a href="/admin/templates" className="inline-block text-white hover:opacity-80 transition">
                      <img
                        src="/logo_v1.png" // or /quicksites-logo.png depending on your asset
                        alt="QuickSites"
                        className="h-6 w-auto"
                        style={{
                          width: '100px',
                          height: '100px',
                        }}
                      />
                    </a>
                  </div>

                  {/* Scrollable Settings */}
                  <div className="flex-1 overflow-y-auto">
                    <SidebarSettings template={template} onChange={handleTemplateChange} />
                  </div>
                </div>
              )}

                  <div
                    className="absolute top-0 right-0 w-2 h-full cursor-col-resize z-50 hover:bg-white/5 transition"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      const startX = e.clientX;
                      const startWidth = sidebarWidth;

                      const onMouseMove = (moveEvent: MouseEvent) => {
                        const newWidth = Math.min(
                          Math.max(startWidth + (moveEvent.clientX - startX), 240),
                          600
                        );
                        setSidebarWidth(newWidth);
                      };

                      const onMouseUp = () => {
                        window.removeEventListener('mousemove', onMouseMove);
                        window.removeEventListener('mouseup', onMouseUp);
                      };

                      window.addEventListener('mousemove', onMouseMove);
                      window.addEventListener('mouseup', onMouseUp);
                    }}
                  />
            </div>

            {/* Preview */}
            <div className="flex-1 overflow-x-hidden">
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
          </div>
        </TabsContent>

        <TabsContent value="history">
          <TemplateHistory template={template} onRevert={handleTemplateChange} />
        </TabsContent>
      </Tabs>

      <Button
        onClick={() => {
          try {
            const parsed = JSON.parse(rawJson);
            const normalized = normalizeTemplate(parsed);
            setRawJson(JSON.stringify(normalized, null, 2));
            toast.success('Template fixed & prettified!');
          } catch (err) {
            toast.error('Invalid JSON');
            console.error(err);
          }
        }}
        variant="secondary"
        className="mt-4 text-green-400 border-green-400"
      >
        Prettify & Fix
      </Button>

      <details className="mt-4 bg-red-950 text-red-100 p-3 rounded-lg border border-red-700">
        <summary className="cursor-pointer font-bold">🧪 Validation Issues (Dev Only)</summary>
        <DevValidatorPanel error={zodError} />
      </details>

      <TemplateJsonEditor
        rawJson={rawJson}
        setRawJson={setRawJson}
        sidebarValues={sidebarValues}
        setSidebarValues={setSidebarValues}
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
