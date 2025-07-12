// components/admin/templates/BlockErrorDisplay.tsx
'use client';

import { AlertTriangle } from 'lucide-react';

export function BlockErrorDisplay({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;

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
    </div>
  );
}
