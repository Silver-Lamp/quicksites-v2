import { Button } from '@/components/ui';
import { Pencil } from 'lucide-react';

export function TemplateEditorToolbar({
  templateName,
  autosaveStatus,
  isRenaming,
  setIsRenaming,
  inputValue,
  setInputValue,
  slugPreview,
  handleRename,
  handleSaveDraft,
  onBack,
  nameExists,
  // setShowNameError,
}: {
  templateName: string;
  autosaveStatus: string;
  isRenaming: boolean;
  setIsRenaming: (v: boolean) => void;
  inputValue: string;
  setInputValue: (v: string) => void;
  slugPreview: string;
  handleRename: () => void;
  handleSaveDraft: () => void;
  onBack: () => void;
  nameExists: boolean;
  setShowNameError: (v: boolean) => void;
}) {
  return (
    <>
      {/* <div className="fixed top-4 left-4 z-50">
        <Button
          variant="outline"
          size="sm"
          onClick={onBack}
          className="shadow-md bg-zinc-900 text-white hover:bg-zinc-800 border border-zinc-700"
        >
          ← Back to Templates
        </Button>
      </div> */}

      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2">
  {isRenaming ? (
    <>
      <input
        ref={(el) => {
          if (el && document.activeElement !== el) {
            setTimeout(() => {
              el.focus();
              el.select();
            }, 0);
          }
        }}
        type="text"
        value={inputValue}
        onChange={(e) => {
          setInputValue(e.target.value);
          // setShowNameError(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleRename();
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            setIsRenaming(false);
          }
        }}
        className="text-xl font-bold bg-background border border-muted rounded px-3 py-2 focus:outline-none focus:ring w-full max-w-md"
      />
      <Button onClick={handleRename} size="sm" variant="default" disabled={!inputValue.trim() || inputValue === templateName || nameExists}>Save</Button>
      {nameExists && (
        <span className="text-xs text-red-500">That name already exists</span>
      )}
      <Button onClick={() => setIsRenaming(false)} size="sm" variant="ghost">Cancel</Button>
    </>
  ) : (
    <>
      <span className="text-xl font-bold text-white">{templateName}</span>
      <Button
        size="icon"
        variant="ghost"
        className="w-7 h-7"
        onClick={() => setIsRenaming(true)}
      >
        <Pencil className="w-4 h-4" />
      </Button>
    </>
  )}
</div>

      <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={autosaveStatus === 'saving'}
          onClick={handleSaveDraft}
          className="bg-zinc-800 text-white border border-zinc-700 hover:bg-zinc-700"
        >
          {autosaveStatus === 'saving' ? 'Saving…' : 'Save Draft'}
        </Button>
        {autosaveStatus === 'saved' && (
  <span className="text-xs text-green-400 animate-fade-out duration-1000">✓ Saved</span>
)}
        {autosaveStatus === 'error' && <span className="text-xs text-red-400">⚠ Error</span>}
      </div>

      {isRenaming && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50">
            <p className="text-xs text-muted-foreground text-center">
            Preview URL: <code className="bg-muted px-2 py-1 rounded">/templates/{slugPreview}</code>
            </p>
        </div>
        )}

    </>
  );
}
