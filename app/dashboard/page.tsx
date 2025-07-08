// app/dashboard/page.tsx
'use client';

import { useDashboardQuery } from '@/lib/querySchemas/dashboard';

export default function DashboardPage() {
  const { params, setParam, clearParam } = useDashboardQuery();

  return (
    <div className="p-6 text-white">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p>Tab: {params.tab}</p>
      <p>Page: {params.page}</p>

      <button onClick={() => setParam('tab', 'activity')}>Switch to Activity</button>
      <button onClick={() => clearParam('filter')}>Clear Filter</button>
    </div>
  );
}
