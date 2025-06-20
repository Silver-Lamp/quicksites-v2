// components/admin/DashboardSelector.tsx

'use client';

import { useState } from 'react';

export function DashboardSelector({
  dashboards,
  activeDashboardId,
  setActiveDashboardId,
  onCreateNew,
}: {
  dashboards: { dashboard_id: string; name: string }[];
  activeDashboardId: string | null;
  setActiveDashboardId: (id: string) => void;
  onCreateNew: (name: string) => void;
}) {
  const [newName, setNewName] = useState('');
  const [showInput, setShowInput] = useState(false);

  return (
    <div className="mb-6">
      <label className="text-sm font-semibold block mb-1">Dashboard</label>
      <select
        value={activeDashboardId || ''}
        onChange={(e) => setActiveDashboardId(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded"
      >
        {dashboards.map((d) => (
          <option key={d.dashboard_id} value={d.dashboard_id}>
            {d.name}
          </option>
        ))}
      </select>

      {showInput ? (
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Dashboard name"
            className="flex-1 px-2 py-1 border rounded"
          />
          <button
            onClick={() => {
              if (newName.trim()) {
                onCreateNew(newName.trim());
                setNewName('');
                setShowInput(false);
              }
            }}
            className="px-3 py-1 bg-blue-600 text-white rounded"
          >
            Create
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowInput(true)}
          className="mt-2 text-blue-600 text-sm hover:underline"
        >
          + Create New Dashboard
        </button>
      )}
    </div>
  );
}
