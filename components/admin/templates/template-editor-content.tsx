'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui';

import type { Template, TemplateData } from '@/types/template';
import { saveTemplate } from '@/admin/lib/saveTemplate';

import TemplateSettingsPanel from './template-settings-panel';
import { TemplateEditorBranding } from './template-editor.branding';
import TemplatePageEditor from './template-page-editor';
import TemplateJsonEditor from './template-json-editor';
import TemplateHistory from './template-history';
import TemplatePreviewWithToggle from './template-preview-with-toggle';
import TemplatePublishModal from './template-publish-modal';
import DevicePreviewWrapper from './device-preview-wrapper';
import ImageUploader from '../admin/image-uploader';
import TemplateImageGallery from '../admin/template-image-gallery';
import TemplateActionToolbar from './template-action-toolbar';
import ThemeScope from '@/components/ui/theme-scope';
import { validateTemplateBlocks } from '@/hooks/validateTemplateBlocks';

function pushWithLimit<T>(stack: T[], item: T, limit = 10): T[] {
  return [...stack.slice(-limit + 1), item];
}

export function TemplateEditorContent({
  template,
  rawJson,
  setRawJson,
  livePreviewData,
  setTemplate,
  autosaveStatus,
  setShowPublishModal,
  recentlyInsertedBlockId,
  setBlockErrors,
}: {
  template: Template;
  rawJson: string;
  setRawJson: (v: string) => void;
  livePreviewData: TemplateData;
  setTemplate: React.Dispatch<React.SetStateAction<Template>>;
  autosaveStatus: string;
  setShowPublishModal: (v: boolean) => void;
  recentlyInsertedBlockId: string | null;
  setBlockErrors: (errors: Record<string, string[]>) => void;
}) {
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

  useEffect(() => {
    localStorage.setItem('templateHistory', JSON.stringify(historyStack));
  }, [historyStack]);

  useEffect(() => {
    localStorage.setItem('templateRedo', JSON.stringify(redoStack));
  }, [redoStack]);

  const handleTemplateChange = (updated: Template) => {
    setHistoryStack((prev) => pushWithLimit(prev, updated, 10));
    setRedoStack((prev) => pushWithLimit(prev, updated, 10));
    setTemplate(updated);
    setRawJson(JSON.stringify(updated.data, null, 2));
  };

  const handleSaveDraft = async () => {
    try {
      const parsed = JSON.parse(rawJson);
      const fullTemplate: Template = { ...template, data: parsed };

      const { isValid, errors } = validateTemplateBlocks(fullTemplate);
      if (!isValid) {
        console.warn('[🛑 Validation Errors]', errors);
        setBlockErrors(errors);
        const firstInvalidId = Object.keys(errors)[0];
        const el = document.getElementById(`block-${firstInvalidId}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        toast.error('Fix validation errors before saving.');
        return;
      }

      const promise = saveTemplate(fullTemplate);

      toast.promise(promise, {
        loading: 'Saving...',
        success: 'Template saved successfully!',
        error: 'Failed to save template',
      });

      const saved = await promise;
      setTemplate(saved);
      setRawJson(JSON.stringify(saved.data, null, 2));
      setBlockErrors({});
    } catch (err: any) {
      console.error('[❌ JSON Parse Error]', err.message);
      toast.error('Invalid JSON: could not save.');
    }
  };

  const handleUndo = () => {
    if (historyStack.length === 0) {
      toast('Nothing to undo');
      return;
    }
    const previous = historyStack[historyStack.length - 1];
    setHistoryStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, template]);
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
    setHistoryStack((prev) => [...prev, template]);
    setTemplate(next);
    setRawJson(JSON.stringify(next.data, null, 2));
    toast.success('Redo successful');
  };

  return (
    <>
      <Tabs defaultValue="edit">
        <TabsList>
          <TabsTrigger value="edit">Edit</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="edit">
          <div className="grid md:grid-cols-2 gap-6 pt-4">
            <div className="space-y-4">
              <TemplateSettingsPanel template={template} onChange={handleTemplateChange} />
              <TemplateEditorBranding
                selectedProfileId={template.brand || ''}
                onSelectProfileId={(selectedId) =>
                  handleTemplateChange({ ...template, brand: selectedId || '' })
                }
              />
              <TemplatePageEditor
                template={template}
                onChange={handleTemplateChange}
                onLivePreviewUpdate={(data) => {
                  setRawJson(JSON.stringify(data, null, 2));
                }}
              />
              <ImageUploader
                siteId={template.site_id || ''}
                templateId={template.id || ''}
                folder="hero"
                dbField="hero_url"
                label="Hero Image"
              />
              <TemplateImageGallery templateId={template.id || ''} />
            </div>
            <TemplateJsonEditor rawJson={rawJson} setRawJson={setRawJson} />
          </div>
        </TabsContent>

        <TabsContent value="preview">
          <ThemeScope mode={isDark ? 'dark' : 'light'}>
            <DevicePreviewWrapper>
              <TemplatePreviewWithToggle
                isDark={isDark}
                toggleDark={() => setIsDark(prev => !prev)}
                data={template.data}
                theme={template.theme}
                brand={template.brand}
                colorScheme="slate"
                showJsonFallback={true}
              />
            </DevicePreviewWrapper>
          </ThemeScope>
        </TabsContent>

        <TabsContent value="history">
          <TemplateHistory template={template} onRevert={handleTemplateChange} />
        </TabsContent>
      </Tabs>

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
    </>
  );
}
