// app/template/[key]/edit/error.tsx
'use client';
export default function Error({ error }: { error: Error }) {
  return <div className="p-6 text-sm text-red-400">Failed to load: {error.message}</div>;
}