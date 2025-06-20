'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient.js';
import DashboardBlock from '@/components/admin/DashboardBlock';
import Heatmap from '@/components/analytics/Heatmap';
import { Button } from '@/components/ui/button';

type LayoutBlock = {
  id: keyof typeof BLOCK_LIBRARY;
};

type LayoutVersion = {
  id: string;
  created_at: string;
  layout: LayoutBlock[];
  hidden?: string[];
};

const BLOCK_LIBRARY = {
  activity: { title: 'Activity', render: <Heatmap daysBack={90} /> },
  engagement: { title: 'Engagement', render: <div>Engagement metrics...</div> },
  retention: { title: 'Retention', render: <div>Retention chart here</div> },
  revenue: { title: 'Revenue', render: <div>Revenue trends...</div> },
};

export default function LayoutEditor({ role = 'user' }) {
  const [layout, setLayout] = useState<LayoutBlock[]>([]);
  const [hidden, setHidden] = useState<string[]>([]);
  const [versions, setVersions] = useState<LayoutVersion[]>([]);

  useEffect(() => {
    (async () => {
      const { data: current } = await supabase
        .from('dashboard_layouts')
        .select('layout, hidden')
        .eq('role', role)
        .single();
      if (current?.layout) setLayout(current.layout);
      if (current?.hidden) setHidden(current.hidden);

      const { data: versionData } = await supabase
        .from('dashboard_layout_versions')
        .select('*')
        .eq('role', role)
        .order('created_at', { ascending: false })
        .limit(5);
      setVersions((versionData as any[]) || []);
    })();
  }, [role]);

  const save = async () => {
    await supabase
      .from('dashboard_layouts')
      .upsert({ role, layout, hidden }, { onConflict: 'role' });

    await supabase.from('dashboard_layout_versions').insert({ role, layout, hidden });

    localStorage.setItem('dashboard-order', JSON.stringify(layout));
    localStorage.setItem('dashboard-hidden', JSON.stringify(hidden));
  };

  const restore = async (versionId: string) => {
    const { data } = await supabase
      .from('dashboard_layout_versions')
      .select('layout, hidden')
      .eq('id', versionId)
      .single();

    if (data) {
      setLayout(data.layout);
      setHidden(data.hidden || []);
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
        <p className="text-sm font-medium mb-1">Recent Versions:</p>
        <ul className="space-y-2 mb-4">
          {versions.map((v) => (
            <li key={v.id} className="flex justify-between items-center text-sm text-gray-600">
              <span>{new Date(v.created_at).toLocaleString()}</span>
              <Button size="sm" onClick={() => restore(v.id)}>
                Restore
              </Button>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        {layout.map((block) =>
          hidden.includes(block.id) ? null : (
            <DashboardBlock
              key={block.id}
              title={BLOCK_LIBRARY[block.id]?.title || block.id}
              actions={
                <Button size="sm" variant="destructive" onClick={() => removeBlock(block.id)}>
                  Remove
                </Button>
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
