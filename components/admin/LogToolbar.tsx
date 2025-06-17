import { useState } from 'react';
import CSVDateRangeExport from '@/components/admin/CSVDateRangeExport';

export function LogToolbar({
  type,
  onSearch,
  onPage,
  page = 1,
  children,
}: {
  type: 'feedback' | 'checkins';
  onSearch?: (term: string) => void;
  onPage?: (page: number) => void;
  page?: number;
  children?: React.ReactNode;
}) {
  const [query, setQuery] = useState('');

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-4 text-sm">
      <CSVDateRangeExport type={type} />
      <div className="flex items-center gap-3">
        {onSearch && (
          <input
            type="text"
            placeholder="Search..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              onSearch(e.target.value);
            }}
            className="px-2 py-1 rounded bg-zinc-900 border border-zinc-700 text-white"
          />
        )}
        {onPage && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPage(Math.max(1, page - 1))}
              className="bg-zinc-700 px-2 py-1 rounded hover:bg-zinc-600 text-white"
              disabled={page <= 1}
            >
              ← Prev
            </button>
            <span className="text-zinc-300">Page {page}</span>
            <button
              onClick={() => onPage(page + 1)}
              className="bg-zinc-700 px-2 py-1 rounded hover:bg-zinc-600 text-white"
            >
              Next →
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
