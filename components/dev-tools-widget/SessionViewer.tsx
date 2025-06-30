// components/dev-tools-widget/SessionViewer.tsx
'use client';

export function SessionViewer({ sessionInfo }: { sessionInfo: any }) {
  return (
    <div className="mt-4">
      <div className="font-semibold text-white mb-2">Session Info</div>
      <pre className="text-xs text-zinc-300 bg-zinc-800 rounded p-2 overflow-auto max-h-48">
        {JSON.stringify(sessionInfo, null, 2)}
      </pre>
    </div>
  );
}
