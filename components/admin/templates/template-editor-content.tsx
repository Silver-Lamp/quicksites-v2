// updated TemplateEditorContent with fallback preview enhancements and brand swatch
'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui';

import type { Template, TemplateData } from '@/types/template';
import { saveTemplate } from '@/admin/lib/saveTemplate';

import CollapsiblePanel from '@/components/ui/collapsible-panel';
import { PanelActions } from './template-action-toolbar';

import TemplateSettingsPanel from './template-settings-panel';
import { TemplateEditorBranding } from './template-editor.branding';
import TemplatePageEditor from './template-page-editor';
import TemplateJsonEditor from './template-json-editor';
import TemplateHistory from './template-history';
import TemplatePreviewWithToggle from './template-preview-with-toggle';
import TemplatePublishModal from './template-publish-modal';
import DevicePreviewWrapper from './device-preview-wrapper';
import TemplateImageGallery from '../admin/template-image-gallery';
import TemplateActionToolbar from './template-action-toolbar';
import ThemeScope from '@/components/ui/theme-scope';
import ImageUploader from '../admin/image-uploader';
import { BlockValidationError, validateTemplateBlocks } from '@/hooks/validateTemplateBlocks';
import { TemplateSaveSchema } from '@/admin/lib/zod/templateSaveSchema';

function pushWithLimit<T>(stack: T[], item: T, limit = 10): T[] {
  return [...stack.slice(-limit + 1), item];
}

const brandColors: Record<string, string> = {
  blue: '#3b82f6',
  green: '#22c55e',
  red: '#ef4444',
  yellow: '#eab308',
};

const brandDetails: Record<string, {
  color: string;
  font: string;
  logoUrl: string;
}> = {
  blue: {
    color: '#3b82f6',
    font: 'Inter',
    logoUrl: '/brands/blue/logo.png',
  },
  green: {
    color: '#22c55e',
    font: 'Poppins',
    logoUrl: '/brands/green/logo.png',
  },
  red: {
    color: '#ef4444',
    font: 'Roboto',
    logoUrl: '/brands/red/logo.png',
  },
};


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
  blockErrors,
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
}) {
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
  
      // First validate blocks (page content)
      const { isValid: blocksAreValid, errors: blockErrorsMap } = validateTemplateBlocks(fullTemplate);
  
      // Then validate the full template object using Zod
      const result = TemplateSaveSchema.safeParse(fullTemplate);
  
      const fieldErrors = result.success ? {} : result.error.flatten().fieldErrors;
      const formErrors = result.success ? [] : result.error.flatten().formErrors;
  
      // Capture Zod template errors if any
      setTemplateErrors(fieldErrors); // includes slug, name, layout, etc
      setFormErrors(formErrors);      // non-field-specific issues
      setBlockErrors(blockErrorsMap); // block-level field issues
  
      if (!result.success) {
        console.log('.:.[⛔ templateSaveSchema failed]', result.error.flatten());
      }
      
      const hasAnyErrors =
        !result.success || Object.keys(blockErrorsMap).length > 0;
  
      if (hasAnyErrors) {
        console.warn('[🚩 Validation Errors]', {
          fieldErrors,
          formErrors,
          blockErrorsMap,
        });
  
        // Scroll to first block issue
        const firstErrorBlockId = Object.keys(blockErrorsMap)[0];
        if (firstErrorBlockId) {
          const el = document.getElementById(`block-${firstErrorBlockId}`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
  
        toast.custom((t) => (
          <div className="bg-red-900/80 text-red-100 border border-red-700 px-4 py-2 rounded shadow max-w-md text-sm">
            <strong>Template validation failed</strong>
            <ul className="mt-1 list-disc list-inside">
              {Object.entries(blockErrorsMap).slice(0, 3).map(([blockId, messages]) => (
                <li key={blockId}>
                  Block <code>{blockId}</code>: {messages.join(', ')}
                </li>
              ))}
              {Object.keys(blockErrorsMap).length > 3 && <li>...and more</li>}
            </ul>
            <button
              onClick={() => toast.dismiss(t.id)}
              className="text-xs mt-2 underline text-red-300 hover:text-red-200"
            >
              Dismiss
            </button>
          </div>
        ));
  
        return;
      }
  
      // ✅ Save if valid
      const promise = saveTemplate(fullTemplate);
  
      toast.promise(promise, {
        loading: 'Saving...',
        success: 'Template saved successfully!',
        error: 'Failed to save template',
      });
  
      const saved = await promise;
      setTemplate(saved);
      setRawJson(JSON.stringify(saved.data, null, 2));
  
      // Clear errors on success
      setBlockErrors({});
      setTemplateErrors({});
      setFormErrors([]);
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
      {blockErrors && Object.keys(blockErrors).length > 0 && (
        <div className="bg-red-900/10 border border-red-700 text-red-300 px-4 py-3 rounded text-sm mb-4">
          ⚠ {Object.keys(blockErrors).length} block(s) have validation issues. Expand pages to review.
        </div>
      )}


      <Tabs defaultValue="edit">
        {process.env.NODE_ENV === 'development' && (
          <details className="text-xs text-yellow-200 bg-black p-3 mb-4 rounded max-h-60 overflow-auto border border-yellow-400/40">
            <summary className="cursor-pointer font-mono text-yellow-300">
              ⛏ Debug: Validation State
            </summary>
            <div className="pt-2 space-y-2">
              <div>
                <strong className="text-yellow-400">templateErrors</strong>
                <pre className="whitespace-pre-wrap">
                  {JSON.stringify(templateErrors, null, 2)}
                </pre>
              </div>
              <div>
                <strong className="text-yellow-400">formErrors</strong>
                <pre className="whitespace-pre-wrap">
                  {JSON.stringify(formErrors, null, 2)}
                </pre>
              </div>
              <div>
                <strong className="text-yellow-400">blockErrors</strong>
                <pre className="whitespace-pre-wrap">
                  {JSON.stringify(blockErrors, null, 2)}
                </pre>
              </div>
            </div>
          </details>
        )}

        <TabsList>
          <TabsTrigger value="edit">Edit</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="edit">
          <div className="grid md:grid-cols-2 gap-6 pt-4">
            <div className="space-y-4">
              <PanelActions />
              <CollapsiblePanel id="template-settings" title="Template Settings">
                <TemplateSettingsPanel template={template} onChange={handleTemplateChange} />
              </CollapsiblePanel>
              {/* <CollapsiblePanel id="template-branding" title="Branding">
                <TemplateEditorBranding
                  selectedProfileId={template.brand || ''}
                  onSelectProfileId={(selectedId) =>
                    handleTemplateChange({ ...template, brand: selectedId || '' })
                  }
                />
              {template.brand && brandDetails[template.brand] ? (
                <div className="mt-4 flex items-center gap-4 p-3 border border-white/10 rounded bg-white/5">
                  <img
                    src={brandDetails[template.brand].logoUrl}
                    alt={`${template.brand} logo`}
                    className="w-12 h-12 object-contain rounded bg-white/10"
                  />
                  <div className="space-y-1 text-sm">
                    <div>
                      <span className="text-muted-foreground">Font:</span>{' '}
                      <span style={{ fontFamily: brandDetails[template.brand].font }}>
                        {brandDetails[template.brand].font}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Primary Color:</span>
                      <div
                        className="w-4 h-4 rounded-full border"
                        style={{ backgroundColor: brandDetails[template.brand].color }}
                      />
                      <code className="text-xs">{brandDetails[template.brand].color}</code>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground italic pt-2">No brand selected.</div>
              )}

              </CollapsiblePanel> */}
              <CollapsiblePanel id="template-pages" title="Pages">
                <TemplatePageEditor
                  template={template}
                  onChange={handleTemplateChange}
                  onLivePreviewUpdate={(data: TemplateData) => setRawJson(JSON.stringify(data, null, 2))}
                  blockErrors={blockErrors || {}}
                />
              </CollapsiblePanel>
              {/* <CollapsiblePanel id="template-gallery" title="Image Gallery">
                <TemplateImageGallery templateId={template.id || ''} />
              </CollapsiblePanel> */}
              {/* <CollapsiblePanel id="template-uploader" title="Hero Image Uploader">
                <ImageUploader
                  siteId={template.site_id || ''}
                  templateId={template.id || ''}
                  folder="hero"
                  dbField="hero_url"
                  label="Hero Image"
                />
                <div className="pt-4">
                  {template.hero_url ? (
                    <img
                      src={template.hero_url}
                      alt="Hero Preview"
                      className="rounded shadow-md max-w-full h-auto"
                    />
                  ) : (
                    <div className="text-muted-foreground text-sm italic">
                      No image uploaded.
                    </div>
                  )}
                </div>
              </CollapsiblePanel> */}
            </div>
            <TemplateJsonEditor rawJson={rawJson} setRawJson={setRawJson} />
          </div>
        </TabsContent>

        <TabsContent value="preview">
          <ThemeScope mode={isDark ? 'dark' : 'light'}>
            <DevicePreviewWrapper>
              <TemplatePreviewWithToggle
                isDark={isDark}
                toggleDark={() => setIsDark((prev) => !prev)}
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
