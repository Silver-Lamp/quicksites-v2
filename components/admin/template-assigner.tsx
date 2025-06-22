'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/admin/lib/supabaseClient';
import { Button } from '@/components/ui/button';

type Template = { id: string; name: string };

export default function TemplateAssigner() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [email, setEmail] = useState('');
  const [selected, setSelected] = useState('');
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('dashboard_layout_templates')
        .select('id, name')
        .order('created_at', { ascending: false });

      if (error) console.error('Error fetching templates:', error);
      setTemplates(data || []);
    })();
  }, []);

  const fetchUserId = async () => {
    const { data: user, error } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (error || !user) {
      alert('User not found');
      return null;
    }

    return user.id as string;
  };

  const assignTemplate = async () => {
    if (!selected || !email) {
      alert('Please provide both an email and a template');
      return;
    }

    const id = await fetchUserId();
    if (!id) return;

    await supabase.from('dashboard_user_layouts').upsert({ user_id: id, template_id: selected });

    alert('✅ Template assigned!');
  };

  return (
    <div className="p-4 border rounded bg-white shadow max-w-xl mt-8">
      <h2 className="text-lg font-semibold mb-3">Assign Template to User</h2>
      <div className="flex flex-col gap-3">
        <input
          placeholder="User email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border p-2 text-sm"
        />
        <select
          className="border p-2 text-sm"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="">Select template</option>
          {templates.map((tpl) => (
            <option key={tpl.id} value={tpl.id}>
              {tpl.name}
            </option>
          ))}
        </select>
        <Button onClick={assignTemplate}>Assign</Button>
      </div>
    </div>
  );
}
