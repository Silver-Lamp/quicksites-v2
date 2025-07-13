// components/admin/templates/BlockErrorDisplay.tsx
'use client';

import { AlertTriangle } from 'lucide-react';
import { blockContentExamples } from '@/lib/blockContentExamples';

export function BlockErrorDisplay({ messages, blockType }: { messages?: string[]; blockType?: string }) {
  if (!messages?.length) return null;

  const example = blockType ? blockContentExamples?.[blockType] : null;

  return (
    <div className="bg-red-500/10 border border-red-500 rounded p-2 mt-2 text-sm text-red-300 space-y-1">
      <div className="flex items-center gap-1 font-medium">
        <AlertTriangle className="w-4 h-4" />
        Validation Error{messages.length > 1 ? 's' : ''}
      </div>
      <ul className="list-disc list-inside pl-2">
        {messages.map((msg, i) => (
          <li key={i}>{msg}</li>
        ))}
      </ul>
      {example && (
        <details className="mt-2 bg-zinc-800/30 border border-zinc-700 rounded p-2">
          <summary className="cursor-pointer text-red-200 underline">Expected structure for type <code>{blockType}</code></summary>
          <pre className="mt-2 text-xs text-red-100 whitespace-pre-wrap">
            {JSON.stringify(example, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}
