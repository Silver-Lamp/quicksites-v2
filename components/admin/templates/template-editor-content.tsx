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

import { motion, AnimatePresence } from 'framer-motion';
import { Settings2, ChevronLeft } from 'lucide-react';

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
  onChange,
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
  onChange: (patch: Partial<Template>) => void;
}) {
  const [zodError, setZodError] = useState<ZodError | null>(null);
  const [showModal, setModal] = useState(false);
  const [historyStack, setHistoryStack] = useState<Template[]>([]);
  const [redoStack, setRedoStack] = useState<Template[]>([]);

  // --- NEW: collapsible sidebar (persisted) ---
  const SETTINGS_KEY = 'qs:settingsOpen';
  const [settingsOpen, setSettingsOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const saved = window.localStorage.getItem(SETTINGS_KEY);
    return saved ? saved === '1' : true;
  });
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SETTINGS_KEY, settingsOpen ? '1' : '0');
    }
  }, [settingsOpen]);

  // Hotkey: "s" toggles rail unless typing
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || t?.isContentEditable) return;
      if (e.key.toLowerCase() === 's') {
        e.preventDefault();
        setSettingsOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  // -------------------------------------------

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
    }
    setTemplate(next);
  };

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
        return prev;
      }
    }

    const pages = nextPagesCandidate;
    const mode: 'light' | 'dark' =
      ((patch as any).color_mode as 'light' | 'dark' | undefined) ??
      ((prev as any).color_mode as 'light' | 'dark' | undefined) ??
      'light';

    return {
      ...prev,
      ...patch,
      color_mode: mode,
      data: { ...prevData, ...nextData, pages },
      pages,
    } as Template;
  }

  const handleTemplateChange = (patch: Partial<Template>) => {
    setHistoryStack((prev) => pushWithLimit(prev, template));
    setRedoStack([]); // clear redo on new change
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
    // debug if needed
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

      const color_mode = (template as any).color_mode ?? 'light';

      const fullTemplate = withSyncedPages({
        ...template,
        ...sidebarValues,
        color_mode,
        data: { ...unwrapped, pages },
      });

      const normalized = normalizeTemplate(fullTemplate);
      const json = JSON.stringify(normalized, null, 2);

      await handleTemplateSave({
        rawJson: json,
        mode,
        onSuccess: (saved) => {
          const ensuredMode = (saved as any)?.color_mode ?? color_mode;
          const synced = withSyncedPages({ ...(saved as any), color_mode: ensuredMode } as Template);
          setTemplate(synced);
          setRawDataFromTemplate(synced);
          setBlockErrors({});
          setZodError(null);
          // toast.success('Draft saved');
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
          <div className="flex relative">
            {/* Gear when collapsed */}
            <AnimatePresence>
              {!settingsOpen && (
                <motion.button
                  key="gear"
                  initial={{ opacity: 0, scale: 0.9, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 10 }}
                  onClick={() => setSettingsOpen(true)}
                  className="fixed left-10 top-20 z-40 inline-flex h-11 w-11 items-center justify-center rounded-full bg-zinc-900 text-zinc-100 shadow-lg ring-1 ring-white/10 border-2 border-purple-500 hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-purple-400"
                  // className="
                  //   relative translate-x-5
                  //   border-2 border-purple-500
                  //   shadow-[0_0_10px_rgba(168,85,247,0.8)]
                  //   rounded-full
                  // "
                  aria-label="Open settings (S)"
                  title="Open settings (S)"
                >
                  <Settings2 className="h-5 w-5" />
                </motion.button>
              )}
            </AnimatePresence>

            {/* Collapsible rail with the existing SidebarSettings inside */}
            <motion.aside
              aria-label="Settings"
              className="relative z-30 mr-4"
              initial={false}
              animate={{ width: settingsOpen ? 320 : 0, marginRight: settingsOpen ? 16 : 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 30 }}
            >
              <AnimatePresence mode="popLayout">
                {settingsOpen && (
                  <motion.div
                    key="settings-body"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.18 }}
                    className="h-full w-[320px] overflow-visible"
                  >
                    <div className="mb-2 flex items-center justify-between pr-2">
                      <div className="flex items-center gap-2 text-sm font-semibold text-white">
                        <Settings2 className="h-4 w-4 text-purple-400" />
                        Settings
                      </div>
                      <button
                        onClick={() => setSettingsOpen(false)}
                        className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-purple-400"
                        aria-label="Collapse settings (S)"
                        title="Collapse settings (S)"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                        Hide
                      </button>
                    </div>

                    {/* IMPORTANT: same component you already use */}
                    <SidebarSettings template={template} onChange={handleTemplateChange} />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.aside>

            {/* Main preview area */}
            <div className="flex-1 min-w-0">
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
