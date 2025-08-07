import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Button, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui';

import type { Template, TemplateData, Theme } from '@/types/template';
import SidebarSettings from '../template-settings-panel/sidebar-settings';
import TemplateJsonEditor from './template-json-editor';
import TemplateHistory from './template-history';
import TemplatePublishModal from './template-publish-modal';
import { TemplateActionToolbar } from './template-action-toolbar';
import { IndustryThemeScope } from '@/components/ui/industry-theme-scope';
import { BlockValidationError } from '@/hooks/validateTemplateBlocks';
import ThemeScope from '@/components/ui/theme-scope';
import DevValidatorPanel from '../dev-validator-panel';
import DevicePreviewWrapper from '@/components/admin/templates/device-preview-wrapper';
import { LiveEditorPreview } from '@/components/editor/live-editor-preview';
import { handleTemplateSave } from '@/admin/lib/handleTemplateSave';
import { ZodError } from 'zod';
import { normalizeTemplate } from '@/admin/utils/normalizeTemplate';
import ClientOnly from '@/components/client-only';
import { unwrapData } from '@/admin/lib/cleanTemplateData';
import { cleanTemplateDataStructure } from '@/admin/lib/cleanTemplateData';
import { prepareTemplateForSave } from '@/admin/lib/prepareTemplateForSave';

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
  setRawJson: React.Dispatch<React.SetStateAction<string>>;
  livePreviewData: TemplateData;
  setTemplate: React.Dispatch<React.SetStateAction<Template>>;
  autosaveStatus: string;
  setShowPublishModal: (v: boolean) => void;
  recentlyInsertedBlockId: string | null;
  setBlockErrors: (errors: Record<string, BlockValidationError[]>) => void;
  blockErrors: Record<string, BlockValidationError[]> | null;
  mode: 'template' | 'site';
}) {
  const [zodError, setZodError] = useState<ZodError | null>(null);
  const [showModal, setModal] = useState(false);
  const [historyStack, setHistoryStack] = useState<Template[]>([]);
  const [redoStack, setRedoStack] = useState<Template[]>([]);
  const [sidebarValues, setSidebarValues] = useState({
    template_name: template.template_name,
    slug: template.slug,
    industry: template.industry,
  });

  const setRawDataFromTemplate = (tpl: Template) => {
    const layoutOnly = cleanTemplateDataStructure(prepareTemplateForSave(tpl));
    setRawJson(JSON.stringify(layoutOnly, null, 2));
  };

  const handleTemplateChange = (updated: Template) => {
    const safeName = updated.template_name === 'Untitled' ? updated.slug : updated.template_name;
    const safeSlug = updated.slug === 'untitled' ? `${safeName}-${Math.random().toString(36).slice(2, 6)}` : updated.slug;
    const final = { ...updated, template_name: safeName, slug: safeSlug };
    setHistoryStack((prev) => pushWithLimit(prev, template));
    setRedoStack([]);
    setTemplate(final);
    setRawDataFromTemplate(final);
    setSidebarValues({ template_name: final.template_name, slug: final.slug, industry: final.industry });
  };

  const handleUndo = () => {
    if (historyStack.length === 0) return toast('Nothing to undo');
    const previous = historyStack[historyStack.length - 1];
    setHistoryStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => pushWithLimit(prev, template));
    setTemplate(previous);
    setRawDataFromTemplate(previous);
    toast.success('Undo successful');
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return toast('Nothing to redo');
    const next = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    setHistoryStack((prev) => pushWithLimit(prev, template));
    setTemplate(next);
    setRawDataFromTemplate(next);
    toast.success('Redo successful');
  };

  const handleSaveDraft = async () => {
    try {
      const parsed = JSON.parse(rawJson);
      const unwrapped = unwrapData(parsed);
      const fullTemplate = { ...template, ...sidebarValues, data: unwrapped };
      const normalized = normalizeTemplate(fullTemplate);
      const json = JSON.stringify(normalized, null, 2);

      await handleTemplateSave({
        rawJson: json,
        mode,
        onSuccess: (saved) => {
          setTemplate(saved);
          setRawDataFromTemplate(saved);
          setBlockErrors({});
          setZodError(null);
        },
        onError: (err) => {
          if (err instanceof ZodError) setZodError(err);
        },
      });
    } catch (err) {
      toast.error('Failed to parse JSON before saving');
    }
  };

  return (
    <IndustryThemeScope>
    <Tabs defaultValue="preview">
      <TabsList>
        <TabsTrigger value="preview">Preview</TabsTrigger>
        <TabsTrigger value="history">History</TabsTrigger>
      </TabsList>

      <TabsContent value="preview">
        <div className="flex">
          <SidebarSettings template={template} onChange={handleTemplateChange} />
          <DevicePreviewWrapper theme={template.theme as Theme}>
            <ThemeScope mode={template.color_mode as 'light' | 'dark'}>
              <LiveEditorPreview
                template={template}
                onChange={handleTemplateChange}
                errors={blockErrors ?? {}}
                industry={template.industry}
                templateId={template.id}
              />
            </ThemeScope>
          </DevicePreviewWrapper>
        </div>
      </TabsContent>

      <TabsContent value="history">
        <TemplateHistory template={template} onRevert={handleTemplateChange} />
      </TabsContent>
{/* 
      <TemplateJsonEditor
        rawJson={rawJson}
        setRawJson={setRawJson}
        sidebarValues={sidebarValues}
        setSidebarValues={(values: any) => setSidebarValues((prev) => ({ ...prev, ...values }))}
        colorMode={template.color_mode as 'light' | 'dark'}
        template={template}
      /> */}

      <TemplateActionToolbar
        template={template}
        autosaveStatus={autosaveStatus}
        onSaveDraft={handleSaveDraft}
        onUndo={handleUndo}
        onRedo={handleRedo}
      />

      <DevValidatorPanel error={zodError} />
      <TemplatePublishModal
        open={showModal}
        onClose={() => setModal(false)}
        snapshotId={template.id || ''}
      />
      {/* <details className="mt-4 bg-red-950 text-red-100 p-3 rounded-lg border border-red-700">
          <summary className="cursor-pointer font-bold">🧪 Validation Issues (Dev Only)</summary>
          <DevValidatorPanel error={zodError} />
        </details> */}
        <ClientOnly>
          {/* <TemplateJsonEditor
            rawJson={rawJson}
            setRawJson={setRawJson}
            sidebarValues={sidebarValues}
            setSidebarValues={(values: any) => {
              setSidebarValues((prev) => {
                const next = { ...prev, ...values };
                setTimeout(() => {
                  const normalized = normalizeTemplate({ ...template, ...next });
                  const cleaned = cleanTemplateDataStructure(normalized);
                  setRawJson(JSON.stringify(cleaned, null, 2));
                }, 0);
                return next;
              });
              handleTemplateChange({ ...template, ...values, color_mode: template.color_mode as 'light' | 'dark' });
            }}
            colorMode={template.color_mode as 'light' | 'dark'}
          /> */}
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
        </ClientOnly>
      </Tabs>
    </IndustryThemeScope>
  );
}
