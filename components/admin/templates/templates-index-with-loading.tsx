// components/admin/templates/templates-index-with-loading.tsx
'use client';
import TemplatesIndexTable from './templates-index-table';

export default function TemplatesIndexWithLoading({
  templates,
  selectedFilter = '',
}: {
  templates?: any[];
  selectedFilter?: string;
}) {
  // If server sent data, don’t fetch again.
  if (Array.isArray(templates)) {
    return <TemplatesIndexTable templates={templates} selectedFilter={selectedFilter} />;
  }
  // (Optional) fallback: a tiny spinner/skeleton or a safe fetch that uses the same
  // owner_id filter. But safest is: require templates from server and skip fetching here.
  return <div className="p-6 text-sm text-zinc-400">Loading…</div>;
}
