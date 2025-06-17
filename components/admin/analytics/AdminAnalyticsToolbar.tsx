import { ReactNode } from 'react';
// import DateRangeToolbar from '@/components/admin/analytics/logs/DateRangeToolbar';

export function AdminAnalyticsToolbar({
  title,
  onRefresh,
  view,
  setView,
  stats,
  children,
}: {
  title?: string;
  onRefresh?: () => void;
  view?: 'daily' | 'weekly' | 'monthly';
  setView?: (v: 'daily' | 'weekly' | 'monthly') => void;
  stats?: { label: string; value: number | string }[];
  children?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        {title && <h2 className="text-xl font-bold text-white">{title}</h2>}
        {/* <DateRangeToolbar basePath="/admin/tools/chart" /> */}
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        {stats?.map((s, i) => (
          <div key={i} className="text-zinc-300">
            <span className="font-medium text-white">{s.value}</span> {s.label}
          </div>
        ))}
        {setView && (
          <div className="flex border border-zinc-700 rounded overflow-hidden">
            {['daily', 'weekly', 'monthly'].map((v) => (
              <button
                key={v}
                onClick={() => setView(v as any)}
                className={`px-3 py-1 ${view === v ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-300'}`}
              >
                {v}
              </button>
            ))}
          </div>
        )}
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="px-3 py-1 bg-zinc-700 hover:bg-zinc-600 text-white rounded"
          >
            🔄 Refresh
          </button>
        )}
        {children}
      </div>
    </div>
  );
}
