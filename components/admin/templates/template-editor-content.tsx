'use client';

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
import { unwrapData, cleanTemplateDataStructure } from '@/admin/lib/cleanTemplateData';

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
  const [historyStack, setHistoryStack] = useState<Template[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('templateHistory');
      return stored ? JSON.parse(stored) : [];
    }
    return [];
  });
  const [redoStack, setRedoStack] = useState<Template[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('templateRedo');
      return stored ? JSON.parse(stored) : [];
    }
    return [];
  });
  const [sidebarValues, setSidebarValues] = useState({
    template_name: template.template_name,
    slug: template.slug,
    industry: template.industry,
  });
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [isMobile, setIsMobile] = useState(false);
  const [isClient, setIsClient] = useState(false);
  useEffect(() => setIsClient(true), []);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const timeout = setTimeout(() => {
      localStorage.setItem('templateHistory', JSON.stringify(historyStack));
    }, 500);
    return () => clearTimeout(timeout);
  }, [historyStack]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const timeout = setTimeout(() => {
      localStorage.setItem('templateRedo', JSON.stringify(redoStack));
    }, 500);
    return () => clearTimeout(timeout);
  }, [redoStack]);
  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 768);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  useEffect(() => {
    const isMissingMeta =
      !template.template_name || !template.slug || template.template_name === 'Untitled' || template.slug === 'untitled';
    if (
      isMissingMeta &&
      sidebarValues.template_name &&
      sidebarValues.slug &&
      sidebarValues.template_name !== 'Untitled' &&
      sidebarValues.slug !== 'untitled'
    ) {
      setRawJson((prev: string) => {
        try {
          const parsed = JSON.parse(prev);
          const merged = {
            ...parsed,
            template_name: sidebarValues.template_name,
            slug: sidebarValues.slug,
            industry: sidebarValues.industry || parsed.industry,
          };
          return JSON.stringify(normalizeTemplate(merged), null, 2);
        } catch {
          return prev;
        }
      });
    }
  }, []);

  const handleTemplateChange = (updated: Template) => {
    const safeName = updated.template_name === 'Untitled'
      ? updated.slug
      : updated.template_name;
    const safeSlug = updated.slug === 'untitled'
      ? safeName || `new-template-${Math.random().toString(36).slice(2, 6)}`
      : updated.slug;
    const final = {
      ...updated,
      template_name: safeName,
      slug: safeSlug,
      color_mode: updated.color_mode || 'dark',
    };
    setHistoryStack((prev) => pushWithLimit(prev, template, 10));
    setRedoStack([]);
    setTemplate(final);
    setRawJson(JSON.stringify(final, null, 2));
    setSidebarValues({
      template_name: final.template_name,
      slug: final.slug,
      industry: final.industry,
    });
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
      const unwrapped = unwrapData(parsed);
      
      const fullTemplate = {
        ...template,
        ...sidebarValues,
        data: unwrapped,
      };
      
      const normalized = normalizeTemplate(fullTemplate);
      const json = JSON.stringify(normalized, null, 2);
      console.log('✅ Final phone before save:', normalized.phone);

      await handleTemplateSave({
        rawJson: json,
        mode,
        onSuccess: (saved) => {
          setTemplate(saved);
          setRawJson(JSON.stringify(saved, null, 2));
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
    <IndustryThemeScope industry={template.industry}>
      <Tabs defaultValue="preview">
        <TabsList className="rounded-lg">
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        {isClient && (
          <>
            <TabsContent value="preview">
  <div className="flex h-full">
  <div
    className={`relative shrink-0 border-r border-white/10 bg-black transition-all duration-300 ${isMobile ? 'w-0 opacity-0' : 'opacity-100'}`}
    style={{ width: isMobile ? 0 : sidebarWidth }}
  >
    {!isMobile && (
      <div className="sticky top-0 h-screen overflow-y-auto flex flex-col rounded-lg" id="sidebar-settings">
        <div className="px-4 py-3 border-b border-white/10">
          <a href="/admin/templates/list" className="inline-block text-white hover:opacity-80 transition">
            <img
              src="/logo_v1.png"
              alt="QuickSites"
              className="h-6 w-auto"
              style={{ width: '100px', height: '100px' }}
            />
          </a>
        </div>
        <div className="flex-1 overflow-y-auto">
          <SidebarSettings
            template={template}
            onChange={handleTemplateChange}
            />
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
          const newWidth = Math.min(Math.max(startWidth + (moveEvent.clientX - startX), 240), 600);
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
  <div className="flex-1 overflow-x-hidden">
    <ThemeScope mode={template.color_mode as 'light' | 'dark'}>
      <DevicePreviewWrapper theme={template.theme as Theme}>
        <IndustryThemeScope industry={template.industry}>
          <ClientOnly>
            <LiveEditorPreview
              template={template}
              onChange={handleTemplateChange}
              industry={template.industry}
              errors={blockErrors ?? {}}
              templateId={template.id || ''}
            />
          </ClientOnly>
        </IndustryThemeScope>
      </DevicePreviewWrapper>
    </ThemeScope>
  </div>
</div>
</TabsContent>
            <TabsContent value="history">
              <TemplateHistory template={template} onRevert={handleTemplateChange} />
            </TabsContent>
          </>
        )}
      </Tabs>
      {/* <Button onClick={() => {
        try {
          const parsed = JSON.parse(rawJson);
          const merged = { ...parsed, ...sidebarValues };
          const normalized = normalizeTemplate(merged);
          handleTemplateChange(normalized);
          toast.success('Template fixed & prettified!');
        } catch (err) {
          toast.error('Invalid JSON');
          console.error(err);
        }
      }} variant="secondary" className="mt-4 text-green-400 border-green-400">
        Prettify & Fix
      </Button> */}
      <details className="mt-4 bg-red-950 text-red-100 p-3 rounded-lg border border-red-700">
        <summary className="cursor-pointer font-bold">🧪 Validation Issues (Dev Only)</summary>
        <DevValidatorPanel error={zodError} />
      </details>
      <ClientOnly>
        <TemplateJsonEditor
          rawJson={rawJson}
          setRawJson={setRawJson}
          sidebarValues={sidebarValues}
          setSidebarValues={(values: any) => {
            setSidebarValues((prev) => {
              const next = { ...prev, ...values };
              setTimeout(() => {
                const normalized = normalizeTemplate({ ...template, ...next });
                setRawJson(JSON.stringify(normalized, null, 2));
              }, 0);
              return next;
            });
            handleTemplateChange({ ...template, ...values, color_mode: template.color_mode as 'light' | 'dark' });
          }}
          colorMode={template.color_mode as 'light' | 'dark'}
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
      </ClientOnly>
    </IndustryThemeScope>
  );
}
