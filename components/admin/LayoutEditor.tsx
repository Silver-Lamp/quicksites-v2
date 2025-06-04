'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import DashboardBlock from '@/components/admin/DashboardBlock';
import Heatmap from '@/components/analytics/Heatmap';
import { Button } from '@/components/admin/ui/button';

const BLOCK_LIBRARY = {
  activity: { title: 'Activity', render: <Heatmap daysBack={90} /> },
  engagement: { title: 'Engagement', render: <div>Engagement metrics...</div> },
  retention: { title: 'Retention', render: <div>Retention chart here</div> },
  revenue: { title: 'Revenue', render: <div>Revenue trends...</div> }
};

export default function LayoutEditor({ role = 'user' }) {
  const [layout, setLayout] = useState([]);
  const [hidden, setHidden] = useState<string[]>([]);
  const [available, setAvailable] = useState(Object.keys(BLOCK_LIBRARY));

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('dashboard_layouts')
        .select('layout, hidden')
        .eq('role', role)
        .single();

      if (data?.layout) setLayout(data.layout);
      if (data?.hidden) setHidden(data.hidden);
    })();
  }, [role]);

  const save = async () => {
    await supabase
      .from('dashboard_layouts')
      .upsert({ role, layout, hidden }, { onConflict: 'role' });

    localStorage.setItem('dashboard-order', JSON.stringify(layout));
    localStorage.setItem('dashboard-hidden', JSON.stringify(hidden));
  };

  const toggleHidden = (id: string) => {
    setHidden((prev) =>
      prev.includes(id) ? prev.filter((h) => h !== id) : [...prev, id]
    );
  };

  const addBlock = (id: string) => {
    if (!layout.find(b => b.id === id)) {
      setLayout([...layout, { id, title: BLOCK_LIBRARY[id].title }]);
    }
  };

  const removeBlock = (id: string) => {
    setLayout(layout.filter((b) => b.id !== id));
    setHidden(hidden.filter((h) => h !== id));
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-xl font-bold mb-4">Layout Editor for Role: {role}</h1>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Add Block:</label>
        <select
          className="text-sm border p-1"
          onChange={(e) => addBlock(e.target.value)}
          defaultValue=""
        >
          <option value="" disabled>Select block</option>
          {available.map((id) => (
            <option key={id} value={id}>
              {BLOCK_LIBRARY[id].title}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        {layout.map((block) =>
          hidden.includes(block.id) ? null : (
            <DashboardBlock
              key={block.id}
              title={BLOCK_LIBRARY[block.id]?.title || block.id}
              actions={
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleHidden(block.id)}
                  >
                    Hide
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => removeBlock(block.id)}
                  >
                    Remove
                  </Button>
                </div>
              }
            >
              {BLOCK_LIBRARY[block.id]?.render ?? <p>No preview available.</p>}
            </DashboardBlock>
          )
        )}
      </div>

      <Button onClick={save}>Save Layout</Button>
    </div>
  );
}
