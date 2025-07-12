// components/ui/render-changed-fields.tsx
'use client';

import { diff } from 'just-diff';
import React from 'react';

export function getChangedFields(original: any, modified: any) {
  return diff(original, modified);
}

export function RenderChangedFields({ original, modified, view = 'inline' }: { original: any; modified: any; view?: 'inline' | 'side-by-side' }) {
  const [mode, setMode] = React.useState(view);
  const changes = getChangedFields(original, modified);

  if (!changes.length) return <div className="text-sm text-muted-foreground">No differences detected.</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <button
          onClick={() => setMode('inline')}
          className={`text-sm px-3 py-1 rounded ${mode === 'inline' ? 'bg-zinc-700 text-white' : 'text-muted-foreground'}`}
        >
          Inline
        </button>
        <button
          onClick={() => setMode('side-by-side')}
          className={`text-sm px-3 py-1 rounded ${mode === 'side-by-side' ? 'bg-zinc-700 text-white' : 'text-muted-foreground'}`}
        >
          Side-by-Side
        </button>
      </div>

      {mode === 'side-by-side' ? (
        <div className="grid grid-cols-2 gap-4 text-sm">
          {changes.map((c, i) => (
            <React.Fragment key={i}>
              <div className="bg-zinc-800 border border-white/10 rounded p-2">
                <div className="font-mono text-yellow-300">{c.path.join('.')}</div>
                <div className="text-muted-foreground">
                  <strong>From:</strong> {JSON.stringify(c.value?.[0])}
                </div>
              </div>
              <div className="bg-zinc-800 border border-white/10 rounded p-2">
                <div className="font-mono text-yellow-300">{c.path.join('.')}</div>
                <div className="text-muted-foreground">
                  <strong>To:</strong> {JSON.stringify(c.value?.[1])}
                </div>
              </div>
            </React.Fragment>
          ))}
        </div>
      ) : (
        <div className="space-y-2 text-sm">
          {changes.map((c, i) => (
            <div key={i} className="bg-zinc-800 border border-white/10 rounded p-2">
              <div className="font-mono text-yellow-300">{c.op} {c.path.join('.')}</div>
              <div className="text-muted-foreground">
                <strong>From:</strong> {JSON.stringify(c.value?.[0])}<br />
                <strong>To:</strong> {JSON.stringify(c.value?.[1])}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
