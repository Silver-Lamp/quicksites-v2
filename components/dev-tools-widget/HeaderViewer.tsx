// components/dev-tools-widget/HeaderViewer.tsx
'use client';

export function HeaderViewer({ headers }: { headers: Record<string, string> }) {
  return (
    <div className="mt-4">
      <div className="font-semibold text-white mb-2">Headers</div>
      <ul className="space-y-1 text-xs text-zinc-300">
        {Object.entries(headers).map(([key, value]) => (
          <li key={key} className="flex justify-between gap-2">
            <span className="text-zinc-400">{key}:</span>
            <span className="truncate text-zinc-200">{value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
