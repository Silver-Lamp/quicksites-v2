// components/admin/templates/template-editor-content.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui';

import type { Template, TemplateData, Theme, Page } from '@/types/template';
import SidebarSettings from '../template-settings-panel/sidebar-settings';
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

/** Mirror pages into both legacy `template.pages` and canonical `template.data.pages`. */
function withSyncedPages(tpl: Template): Template {
  const unwrappedData = unwrapData((tpl as any).data ?? {});
  const candidate =
    Array.isArray(unwrappedData?.pages)
      ? unwrappedData.pages
      : Array.isArray((tpl as any).pages)
      ? (tpl as any).pages
      : [];

  const data = { ...(tpl.data ?? {}), ...unwrappedData, pages: candidate };

  return { ...tpl, pages: candidate, data } as Template;
}

export function EditorContent({
  template,
  rawJson,
  setRawJson,
  livePreviewData, // kept for API parity
  setTemplate,
  autosaveStatus,
  recentlyInsertedBlockId, // kept for API parity
  setBlockErrors,
  blockErrors,
  mode,
  setShowPublishModal, // optional
}: {
  template: Template;
  rawJson: string;
  setRawJson: React.Dispatch<React.SetStateAction<string>>;
  livePreviewData: TemplateData;
  setTemplate: React.Dispatch<React.SetStateAction<Template>>;
  autosaveStatus: string;
  recentlyInsertedBlockId: string | null;
  setBlockErrors: (errors: Record<string, BlockValidationError[]>) => void;
  blockErrors: Record<string, BlockValidationError[]> | null;
  mode: 'template' | 'site';
  setShowPublishModal?: (v: boolean) => void;
}) {
  const [zodError, setZodError] = useState<ZodError | null>(null);
  const [showModal, setModal] = useState(false);
  const [historyStack, setHistoryStack] = useState<Template[]>([]);
  const [redoStack, setRedoStack] = useState<Template[]>([]);

  // keep local + parent (if provided) in sync
  const setModalSynced = (open: boolean) => {
    setModal(open);
    setShowPublishModal?.(open);
  };

  // Prefer data.pages first, fallback to top-level pages
  const initialPages: Page[] =
    (template?.data as any)?.pages ?? (template as any)?.pages ?? [];

  const [sidebarValues, setSidebarValues] = useState({
    template_name: template.template_name,
    slug: template.slug,
    industry: template.industry,
    pages: initialPages,
  });

  const setRawDataFromTemplate = (tpl: Template) => {
    const layoutOnly = cleanTemplateDataStructure(prepareTemplateForSave(tpl));
    setRawJson(JSON.stringify(layoutOnly, null, 2));
  };

  const hydratingRef = useRef(true);
  useEffect(() => {
    const t = setTimeout(() => (hydratingRef.current = false), 500);
    return () => clearTimeout(t);
  }, []);

  const setTemplateGuarded = (next: Template) => {
    const prevCount =
      (template?.data?.pages?.length ?? template?.pages?.length ?? 0);
    const nextCount =
      (next?.data?.pages?.length ?? next?.pages?.length ?? 0);

    if (prevCount > 1 && nextCount === 1) {
      console.warn('[⚠️ PAGES SHRUNK]', { prevCount, nextCount, nextSnapshot: next });
      // Optional: throw new Error('Pages shrunk unexpectedly');
    }
    setTemplate(next);
  };


  /**
   * Deep-merge a template patch into the previous template.
   * - Never drops pages accidentally.
   * - Mirrors pages to both data.pages (canonical) and legacy pages.
   * - Optional guard to ignore accidental "shrink to 1 Home page" during hydration.
   */
  function mergeTemplate(
    prev: Template,
    patch: Partial<Template>,
    opts?: { isHydrating?: boolean }
  ): Template {
    const prevData = prev.data ?? {};
    const nextData = (patch as any).data ?? {};

    const prevPages =
      (prevData as any).pages ?? (prev as any).pages ?? [];

    const nextPagesCandidate = Array.isArray((nextData as any).pages)
      ? (nextData as any).pages
      : Array.isArray((patch as any).pages)
      ? (patch as any).pages
      : prevPages;

    if (opts?.isHydrating) {
      const prevCount = Array.isArray(prevPages) ? prevPages.length : 0;
      const nextCount = Array.isArray(nextPagesCandidate) ? nextPagesCandidate.length : 0;

      if (
        prevCount > 1 &&
        nextCount === 1 &&
        (nextPagesCandidate[0]?.slug === 'home' || nextPagesCandidate[0]?.title === 'Home')
      ) {
        return prev; // ignore spurious hydration collapse
      }
    }

    const pages = nextPagesCandidate;

    return {
      ...prev,
      ...patch,
      data: { ...prevData, ...nextData, pages },
      pages,
    } as Template;
  }

  const handleTemplateChange = (patch: Partial<Template>) => {
    setHistoryStack((prev) => pushWithLimit(prev, template));
    setRedoStack([]); // clear redo on new change
    console.log('[EditorContent] handleTemplateChange', { patch, template });
    const merged = mergeTemplate(template, patch, { isHydrating: hydratingRef.current });
    setTemplateGuarded(merged);
    setRawDataFromTemplate(merged);
    setSidebarValues((v) => ({
      ...v,
      template_name: merged.template_name,
      slug: merged.slug,
      industry: merged.industry,
      pages: merged.data?.pages ?? merged.pages ?? [],
    }));
  };

  useEffect(() => {
    // Debug visibility if you need it
    // console.log('[EditorContent] pages', {
    //   top: (template as any).pages?.length,
    //   data: template?.data?.pages?.length,
    // });
  }, [template]);

  const handleUndo = () => {
    if (historyStack.length === 0) return toast('Nothing to undo');
    const previous = historyStack[historyStack.length - 1];
    setHistoryStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => pushWithLimit(prev, template));
    const synced = withSyncedPages(previous);
    setTemplate(synced);
    setRawDataFromTemplate(synced);
    setSidebarValues((v) => ({
      ...v,
      template_name: synced.template_name,
      slug: synced.slug,
      industry: synced.industry,
      pages: (synced.data as any)?.pages ?? synced.pages ?? [],
    }));
    toast.success('Undo successful');
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return toast('Nothing to redo');
    const next = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    setHistoryStack((prev) => pushWithLimit(prev, template));
    const synced = withSyncedPages(next);
    setTemplate(synced);
    setRawDataFromTemplate(synced);
    setSidebarValues((v) => ({
      ...v,
      template_name: synced.template_name,
      slug: synced.slug,
      industry: synced.industry,
      pages: (synced.data as any)?.pages ?? synced.pages ?? [],
    }));
    toast.success('Redo successful');
  };

  const handleSaveDraft = async () => {
    try {
      const parsed = JSON.parse(rawJson);
      const unwrapped = unwrapData(parsed);

      const pages =
        sidebarValues.pages ??
        (template.data as any)?.pages ??
        (template as any)?.pages ??
        [];

      const fullTemplate = withSyncedPages({
        ...template,
        ...sidebarValues,
        data: { ...unwrapped, pages },
      });

      const normalized = normalizeTemplate(fullTemplate);
      const json = JSON.stringify(normalized, null, 2);

      await handleTemplateSave({
        rawJson: json,
        mode,
        onSuccess: (saved) => {
          const synced = withSyncedPages(saved);
          setTemplate(synced);
          setRawDataFromTemplate(synced);
          setBlockErrors({});
          setZodError(null);
          toast.success('Draft saved');
        },
        onError: (err) => {
          if (err instanceof ZodError) setZodError(err);
          toast.error('Save failed');
        },
      });
    } catch {
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
            {/* <- IMPORTANT: wire settings to our local change handler */}
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

        <DevValidatorPanel error={zodError} />

        <TemplatePublishModal
          open={showModal}
          onClose={() => setModalSynced(false)}
          snapshotId={template.id || ''}
        />

        <ClientOnly>
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
