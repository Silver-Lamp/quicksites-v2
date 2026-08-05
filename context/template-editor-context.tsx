// context/template-editor-context.tsx
'use client';

import * as React from 'react';
import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { useTemplateEditorState } from '@/components/admin/templates/use-template-editor-state';
import type { Snapshot, Template } from '@/types/template';

type Ctx = ReturnType<typeof useTemplateEditorState> & { colorMode: 'light' | 'dark' };

const TemplateEditorContext = createContext<Ctx | null>(null);

/* ---------------- deep merge helpers ---------------- */

function mergeJson(a: any, b: any) {
  const out: any = { ...(a ?? {}) };
  for (const [k, v] of Object.entries(b ?? {})) {
    if (k === 'meta' && typeof out.meta === 'object' && typeof v === 'object') {
      out.meta = { ...out.meta, ...v };
    } else {
      out[k] = v;
    }
  }
  return out;
}

function deepMergeTemplate(prev: Template | null, next: Partial<Template> | null): Template {
  if (!prev) return (next as Template) ?? ({} as Template);
  if (!next) return prev;

  const merged: any = { ...prev, ...next };

  // Shallow-merge JSON data so editors that only send {data:{blocks}} don't clobber {data:{meta}}
  if (prev.data || (next as any).data) {
    merged.data = mergeJson(prev.data, (next as any).data);
  }

  return merged as Template;
}

export function TemplateEditorProvider({
  templateName,
  initialData,
  onRename,
  children,
  colorMode,
  readOnly = false,
}: {
  templateName: string;
  initialData?: Snapshot;
  onRename?: (name: string) => void;
  children: ReactNode;
  colorMode: 'light' | 'dark';
  /**
   * ⚠️ SET THIS ON A PUBLIC RENDER. The published site page wraps its output in this provider so
   * block renderers can read template context — but it is a VISITOR's browser, with no session
   * and nothing to reconcile. Without this the mount effect below fired
   * `GET /api/templates/state` on every page view of every published site: a guaranteed 401, a
   * wasted round-trip, and a red console error on 98 customer sites, none of which affected what
   * a visitor saw, which is exactly why it survived so long.
   */
  readOnly?: boolean;
}) {
  const editor = useTemplateEditorState({ templateName, initialData, onRename, colorMode, mode: 'template' });

  // Safely detect common fields/mutators from the hook without assuming exact shape
  const template = (editor as any).template as Template | null;
  const setTemplate = (editor as any).setTemplate as ((updater: (prev: Template | null) => Template) => void) | undefined;
  const rev = (editor as any).rev as number | undefined;
  const setRev = (editor as any).setRev as ((n: number) => void) | undefined;

  const applyServerRow = React.useCallback(
    (row: Partial<Template> | null | undefined) => {
      if (!row || !setTemplate) return;
      setTemplate((prev) => deepMergeTemplate(prev, row ?? {}));
    },
    [setTemplate]
  );

  // Unified refresh that pulls canonical columns + data from state endpoint and merges
  const refreshFromServer = React.useCallback(async () => {
    try {
      const id =
        (template as any)?.id ??
        (editor as any)?.templateId ??
        (editor as any)?.id ??
        null;
      if (!id) return;

      const res = await fetch(`/api/templates/state?id=${id}`, { cache: 'no-store' });
      if (!res.ok) return;
      const payload = await res.json();
      if (payload?.template) applyServerRow(payload.template);
      if (typeof payload?.rev === 'number' && setRev) setRev(payload.rev);
    } catch {
      /* ignore */
    }
  }, [template, editor, applyServerRow, setRev]);

  // Decorate commit so we always merge the authoritative row after saving
  const originalCommitPatch =
    ((editor as any).commitPatch as ((patch: any, opts?: any) => Promise<any>)) ||
    ((editor as any).commit as ((patch: any, opts?: any) => Promise<any>)) ||
    null;

  const commitPatch = React.useCallback(
    async (patch: any, opts?: any) => {
      if (originalCommitPatch) {
        const result = await originalCommitPatch(patch, opts);
        // Prefer immediate merge from commit route if it returns a row
        if (result?.template) {
          applyServerRow(result.template);
          if (typeof result?.rev === 'number' && setRev) setRev(result.rev);
        } else {
          // Otherwise refetch canonical state
          await refreshFromServer();
        }
        return result;
      } else {
        // Fallback: if hook doesn't expose commit, just try server refresh
        await refreshFromServer();
        return null;
      }
    },
    [originalCommitPatch, applyServerRow, refreshFromServer, setRev]
  );

  // Decorate loadState (if present) to ensure we merge canonical columns afterwards.
  const originalLoadState = (editor as any).loadState as (() => Promise<void>) | undefined;
  const loadState = React.useCallback(async () => {
    if (originalLoadState) {
      await originalLoadState();
      await refreshFromServer();
    } else {
      await refreshFromServer();
    }
  }, [originalLoadState, refreshFromServer]);

  // Expose the decorated API while keeping everything else as-is
  const value = React.useMemo(
    () =>
      ({
        ...editor,
        // overrides / additions:
        loadState,
        commitPatch,
        // Re-pull canonical columns + data from the server and merge into editor state — lets a
        // surface that mutated the template out-of-band (e.g. the readiness pipeline endpoint)
        // refresh the live checklist/preview without a full page reload.
        refreshFromServer,
        colorMode: colorMode as 'light' | 'dark',
      }) as Ctx,
    [editor, loadState, commitPatch, refreshFromServer, colorMode]
  );

  // Initial mount: reconcile with the server once — but only where there is an editor to
  // reconcile FOR. On a public render there is no session, so this can only ever 401.
  React.useEffect(() => {
    if (readOnly) return;
    void refreshFromServer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly]);

  return (
    <TemplateEditorContext.Provider value={value}>
      {children}
    </TemplateEditorContext.Provider>
  );
}

export function useTemplateEditor() {
  const ctx = useContext(TemplateEditorContext);
  if (!ctx) throw new Error('useTemplateEditor must be used within TemplateEditorProvider');
  return ctx;
}
