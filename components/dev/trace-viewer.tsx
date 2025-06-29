// components/dev/trace-viewer.tsx
'use client';

import { useEffect, useState } from 'react';

export default function TraceViewer() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const data = {
    traceId: document?.body?.dataset?.traceId ?? '',
    sessionId: document?.body?.dataset?.sessionId ?? '',
    role: document?.body?.dataset?.userRole ?? '',
    userId: document?.body?.dataset?.userId ?? '',
    ab: document?.body?.dataset?.abVariant ?? '',
  };

  return (
    <div className="fixed bottom-4 left-4 left-[50px] z-50 bg-black/80 text-white text-xs px-4 py-3 rounded shadow-lg max-w-xs pointer-events-auto space-y-1 border border-zinc-700">
      <div className="flex justify-between items-center">
        <strong className="text-indigo-400">Trace</strong>
        <button
          onClick={() => setVisible(false)}
          className="text-zinc-400 hover:text-red-400 text-xs"
        >
          ✕
        </button>
      </div>
      <div><span className="text-zinc-400">traceId:</span> {data.traceId.slice(0, 8)}</div>
      <div><span className="text-zinc-400">session:</span> {data.sessionId?.slice(0, 8)}</div>
      <div><span className="text-zinc-400">user:</span> {data.userId?.slice(0, 8) || 'guest'}</div>
      <div><span className="text-zinc-400">role:</span> {data.role}</div>
      {data.ab && <div><span className="text-zinc-400">A/B:</span> {data.ab}</div>}
    </div>
  );
}
