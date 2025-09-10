// components/admin/templates/template-editor-toolbar.tsx
'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui';
import {
  Pencil,
  ArrowLeft,
  Save as SaveIcon,
  Rocket,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

type Props = {
  templateName: string;
  autosaveStatus?: string; // 'saved' | 'saving' | 'error' | etc.
  isRenaming: boolean;
  setIsRenaming: (v: boolean) => void;
  inputValue: string;
  setInputValue: (v: string) => void;
  slugPreview?: string;
  handleRename: () => void;
  nameExists?: boolean;
  handleSaveDraft?: () => void;
  onBack?: () => void;
  setShowNameError?: (v: boolean) => void;

  // optional: one-click Save & Publish (commit → snapshot → publish)
  onSaveAndPublish?: () => void;
  busy?: boolean; // drive both buttons' disabled/loading state
};

function extractTemplateIdFromPath(pathname: string | null): string | null {
  if (!pathname) return null;
  // Expect /template/{id}/edit (or /template/{id})
  const parts = pathname.split('/').filter(Boolean);
  const i = parts.indexOf('template');
  if (i >= 0 && parts[i + 1]) return parts[i + 1];
  return null;
}

export function TemplateEditorToolbar({
  templateName,
  autosaveStatus = '',
  isRenaming,
  setIsRenaming,
  inputValue,
  setInputValue,
  slugPreview = '',
  handleRename,
  nameExists = false,
  handleSaveDraft,
  onBack,
  setShowNameError,
  onSaveAndPublish,
  busy = false,
}: Props) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const pathname = usePathname();

  // Live display name shown in the top-left
  const [displayName, setDisplayName] = React.useState<string>(templateName);

  // Keep local display name in sync with server-provided prop
  React.useEffect(() => {
    setDisplayName(templateName);
  }, [templateName]);

  const emitTitle = (name: string) => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('qs:template:title', { detail: { name } }));
  };

  // 🔑 NEW: Resolve the real display name on initial load (no dependency on side panel)
  React.useEffect(() => {
    const id = extractTemplateIdFromPath(pathname ?? null);
    if (!id) return;

    let cancelled = false;

    (async () => {
      // 1) Try base-level display name (template_base_meta or fallback per API)
      try {
        const r = await fetch(`/api/templates/base-name?template_id=${encodeURIComponent(id)}`, {
          cache: 'no-store',
        });
        if (r.ok) {
          const j = await r.json().catch(() => ({} as any));
          const apiName = (j?.display_name || '').toString().trim();
          if (apiName && !cancelled) {
            setDisplayName(apiName);
            emitTitle(apiName);
            return; // done
          }
        }
      } catch {
        // fall through to state fetch
      }

      // 2) Fallback: fetch template state and derive (meta.siteTitle → template_name → slug)
      try {
        const s = await fetch(`/api/templates/state?id=${encodeURIComponent(id)}`, {
          cache: 'no-store',
        });
        if (!s.ok) return;
        const j2 = await s.json().catch(() => ({} as any));
        // tolerate different shapes
        const t =
          (j2?.template ??
            j2?.item ??
            j2?.row ??
            j2) as any;

        const data = (t?.data ?? {}) as any;
        const siteTitle = (data?.meta?.siteTitle || '').toString().trim();
        const derived =
          siteTitle ||
          (t?.template_name || '').toString().trim() ||
          (t?.slug || '').toString().trim() ||
          '';

        if (derived && !cancelled) {
          setDisplayName(derived);
          emitTitle(derived);
        }
      } catch {
        /* ignore */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  // Optimistic updates from Identity Panel while typing
  React.useEffect(() => {
    const handler = (e: Event) => {
      try {
        const ce = e as CustomEvent<{ name?: string }>;
        const name = (ce.detail?.name || '').trim();
        if (name) setDisplayName(name);
      } catch {
        /* no-op */
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('qs:template:title', handler as EventListener);
      return () =>
        window.removeEventListener('qs:template:title', handler as EventListener);
    }
  }, []);

  React.useEffect(() => {
    if (isRenaming && inputRef.current && document.activeElement !== inputRef.current) {
      const t = setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
      return () => clearTimeout(t);
    }
  }, [isRenaming]);

  const safeSetNameError = (v: boolean) => {
    try {
      setShowNameError?.(v);
    } catch {}
  };

  const trimmed = inputValue.trim();
  const canRename = Boolean(trimmed) && trimmed !== displayName && !nameExists;

  const onSubmitRename = (e?: React.SyntheticEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (!canRename) {
      safeSetNameError(!trimmed || nameExists);
      return;
    }
    // Optimistically reflect immediately
    setDisplayName(trimmed);
    emitTitle(trimmed);
    handleRename();
  };

  const renderAutosaveBadge = () => {
    if (autosaveStatus === 'saved') {
      return (
        <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5" /> Saved
        </span>
      );
    }
    if (autosaveStatus === 'error') {
      return (
        <span className="inline-flex items-center gap-1 text-xs text-red-400">
          <AlertTriangle className="h-3.5 w-3.5" /> Error
        </span>
      );
    }
    if (autosaveStatus === 'saving' || autosaveStatus === 'pending') {
      return (
        <span className="inline-flex items-center gap-1 text-xs text-white/80">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
        </span>
      );
    }
    return null;
  };

  return (
    <>
      {/* Top bar: Back · Title/Rename · Actions */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Back + Title/Rename */}
        <div className="flex min-w-0 items-center gap-2">
          {onBack && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={onBack}
              title="Back"
              className="shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}

          {/* Title / Rename inline */}
          <div className="min-w-0">
            {isRenaming ? (
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => {
                    setInputValue(e.target.value);
                    safeSetNameError(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.stopPropagation();
                      onSubmitRename();
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsRenaming(false);
                    }
                  }}
                  className="text-xl font-bold bg-background border border-muted rounded px-3 py-2 focus:outline-none focus:ring w-full max-w-md"
                />
                <Button
                  type="button"
                  onClick={onSubmitRename}
                  size="sm"
                  variant="default"
                  disabled={!canRename}
                  title={nameExists ? 'Name already exists' : 'Apply new name'}
                >
                  Rename
                </Button>
                {nameExists && (
                  <span className="text-xs text-red-500">That name already exists</span>
                )}
                <Button
                  type="button"
                  onClick={() => setIsRenaming(false)}
                  size="sm"
                  variant="ghost"
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="truncate text-xl font-bold text-white">
                  {displayName}
                </span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="w-7 h-7"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsRenaming(true);
                  }}
                  title="Rename template"
                >
                  <Pencil className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Actions + Autosave status */}
        <div className="flex items-center gap-2">
          {renderAutosaveBadge()}

          {handleSaveDraft && (
            <Button
              type="button"
              size="sm"
              onClick={handleSaveDraft}
              disabled={busy}
              title="Save current draft"
              className="gap-2"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <SaveIcon className="h-4 w-4" />}
              {busy ? 'Saving…' : 'Save'}
            </Button>
          )}

          {onSaveAndPublish && (
            <Button
              type="button"
              size="sm"
              onClick={onSaveAndPublish}
              disabled={busy}
              title="Save and publish snapshot"
              className="gap-2"
            >
              <Rocket className="h-4 w-4" />
              {busy ? 'Working…' : 'Save & Publish'}
            </Button>
          )}
        </div>
      </div>

      {/* Slug preview under the rename input */}
      {isRenaming && (
        <div className="mb-2">
          <p className="text-xs text-muted-foreground">
            Preview URL:{' '}
            <code className="bg-muted px-2 py-1 rounded">/templates/{slugPreview}</code>
          </p>
        </div>
      )}
    </>
  );
}
