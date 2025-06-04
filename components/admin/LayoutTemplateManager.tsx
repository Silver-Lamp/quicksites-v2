'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/admin/ui/button';

export default function LayoutTemplateManager({
  currentLayout,
  currentHidden,
  onApply
}: {
  currentLayout: any[];
  currentHidden: string[];
  onApply: (layout: any[], hidden: string[]) => void;
}) {
  const [templates, setTemplates] = useState([]);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');

  useEffect(() => {
    supabase
      .from('dashboard_layout_templates')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => setTemplates(data || []));
  }, []);

  const saveTemplate = async () => {
    if (!name) return;
    await supabase.from('dashboard_layout_templates').insert({
      name,
      description: desc,
      layout: currentLayout,
      hidden: currentHidden
    });
    setName('');
    setDesc('');
    const { data } = await supabase
      .from('dashboard_layout_templates')
      .select('*')
      .order('created_at', { ascending: false });
    setTemplates(data || []);
  };

  const applyTemplate = async (id: string) => {
    const { data } = await supabase
      .from('dashboard_layout_templates')
      .select('layout, hidden')
      .eq('id', id)
      .single();
    if (data) {
      onApply(data.layout, data.hidden || []);
    }
  };

  return (
    <div className="mb-6 p-4 bg-white border rounded shadow">
      <h2 className="text-lg font-semibold mb-2">Layout Templates</h2>
      <div className="flex gap-3 mb-2">
        <input
          placeholder="Template name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border px-2 py-1 text-sm"
        />
        <input
          placeholder="Description (optional)"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          className="border px-2 py-1 text-sm"
        />
        <Button onClick={saveTemplate}>Save as Template</Button>
      </div>

      <ul className="space-y-2 text-sm">
        {templates.map((tpl) => (
          <li key={tpl.id} className="flex justify-between items-center">
            <span>
              <strong>{tpl.name}</strong> – {tpl.description}
            </span>
            <Button size="sm" onClick={() => applyTemplate(tpl.id)}>
              Apply
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
