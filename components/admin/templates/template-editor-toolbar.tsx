// components/admin/templates/template-editor-toolbar.tsx
'use client';

import { Button } from '@/components/ui';
import { Pencil } from 'lucide-react';
import * as React from 'react';

export function TemplateEditorToolbar({
  templateName,
  autosaveStatus,
  isRenaming,
  setIsRenaming,
  inputValue,
  setInputValue,
  slugPreview,
  handleRename,
  nameExists,
  handleSaveDraft,
  onBack,
  setShowNameError,
}: {
  templateName: string;
  autosaveStatus: string;
  isRenaming: boolean;
  setIsRenaming: (v: boolean) => void;
  inputValue: string;
  setInputValue: (v: string) => void;
  slugPreview: string;
  handleRename: () => void;
  nameExists: boolean;
  handleSaveDraft: () => void;
  onBack: () => void;
  setShowNameError: (v: boolean) => void;
}) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (isRenaming && inputRef.current && document.activeElement !== inputRef.current) {
      // defer to ensure mount
      const t = setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
      return () => clearTimeout(t);
    }
  }, [isRenaming]);

  const canRename = Boolean(inputValue.trim()) && inputValue.trim() !== templateName && !nameExists;

  const onSubmitRename = (e?: React.SyntheticEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (!canRename) {
      setShowNameError(!inputValue.trim() || nameExists);
      return;
    }
    handleRename(); // ✅ actually invoke the rename handler
  };

  return (
    <>
      {/* Title / Rename inline */}
      <div className="">
        {isRenaming ? (
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                setShowNameError(false);
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
            <span className="text-xl font-bold text-white">{templateName}</span>
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

      {/* Right status badges */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
        {/* If you bring back Save Draft here, ensure it calls the correct save path, not rename. */}
        {autosaveStatus === 'saved' && (
          <span className="text-xs text-green-400 animate-fade-out duration-1000">✓ Saved</span>
        )}
        {autosaveStatus === 'error' && (
          <span className="text-xs text-red-400">⚠ Error</span>
        )}
      </div>

      {/* Slug preview under the rename input */}
      {isRenaming && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50">
          <p className="text-xs text-muted-foreground text-center">
            Preview URL:{' '}
            <code className="bg-muted px-2 py-1 rounded">
              /templates/{slugPreview}
            </code>
          </p>
        </div>
      )}
    </>
  );
}
