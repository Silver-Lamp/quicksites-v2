// components/admin/templates/template-editor-toolbar.tsx
'use client';

import * as React from 'react';
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

  // NEW (optional): one-click Save & Publish (commit → snapshot → publish)
  onSaveAndPublish?: () => void;
  busy?: boolean; // drive both buttons' disabled/loading state
};

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
  const canRename = Boolean(trimmed) && trimmed !== templateName && !nameExists;

  const onSubmitRename = (e?: React.SyntheticEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (!canRename) {
      safeSetNameError(!trimmed || nameExists);
      return;
    }
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
                  {templateName || 'Untitled'}
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
