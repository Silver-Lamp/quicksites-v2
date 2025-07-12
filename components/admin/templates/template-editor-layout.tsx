// components/admin/templates/template-editor-layout.tsx
'use client';

import { useTemplateEditor } from '@/context/template-editor-context';
// import { Button } from '@/components/ui/button';
import { cn } from '@/admin/lib/utils';
import { CheckCircle, Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';

export default function TemplateEditorLayout({
  children,
  toolbar,
  preview,
  className = '',
}: {
  children: ReactNode;
  toolbar?: ReactNode;
  preview?: ReactNode;
  className?: string;
}) {
  const { autosave, isCreating, template } = useTemplateEditor();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b bg-zinc-900 px-4 py-2">
        <div className="text-sm font-semibold text-white">
          {template.template_name}
          <span className="ml-2 text-xs text-muted-foreground">
            {autosave.status === 'saving' && (
              <span className="flex items-center gap-1 text-yellow-400">
                <Loader2 className="animate-spin w-3 h-3" />
                Saving...
              </span>
            )}
            {autosave.status === 'saved' && (
              <span className="flex items-center gap-1 text-green-400">
                <CheckCircle className="w-3 h-3" />
                Saved
              </span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-2">{toolbar}</div>
      </header>

      {/* Main Content */}
      <div
        className={cn(
          'grid grid-cols-1 md:grid-cols-[1fr_300px] gap-4 p-6 max-w-screen-xl mx-auto',
          className
        )}
      >
        <div className="w-full">{children}</div>
        {preview && (
          <aside className="bg-white/5 border border-white/10 rounded p-3 overflow-y-auto">
            {preview}
          </aside>
        )}
      </div>

      {/* Optional footer/actions could go here */}
    </div>
  );
}
