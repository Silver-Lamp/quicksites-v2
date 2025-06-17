'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient.js';
import { Button } from '@/components/ui/button';

type Template = {
  id: string;
  name: string;
  description?: string;
  layout: { id: string }[];
  hidden: string[];
  created_at: string;
};

export default function LayoutTemplateManager({
  currentLayout,
  currentHidden,
  onApply,
}: {
  currentLayout: { id: string }[];
  currentHidden: string[];
  onApply: (layout: { id: string }[], hidden: string[]) => void;
}) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('dashboard_layout_templates')
        .select('*')
        .order('created_at', { ascending: false });

      setTemplates(data || []);
    })();
  }, []);

  const saveTemplate = async () => {
    if (!name.trim()) return;

    await supabase.from('dashboard_layout_templates').insert({
      name,
      description: desc,
      layout: currentLayout,
      hidden: currentHidden,
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
