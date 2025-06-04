'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/admin/ui/button';

export default function TemplateAssigner() {
  const [templates, setTemplates] = useState([]);
  const [email, setEmail] = useState('');
  const [selected, setSelected] = useState('');

  useEffect(() => {
    supabase
      .from('dashboard_layout_templates')
      .select('id, name')
      .order('created_at', { ascending: false })
      .then(({ data }) => setTemplates(data || []));
  }, []);

  const assignTemplate = async () => {
    const { data: user } = await supabase
      .from('users') // or auth.users if querying directly from Supabase auth
      .select('id')
      .eq('email', email)
      .single();

    if (!user) return alert('User not found');

    await supabase
      .from('dashboard_user_layouts')
      .upsert({ user_id: user.id, template_id: selected });

    alert('Template assigned!');
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
