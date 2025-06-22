'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/admin/lib/supabaseClient';
import { Button } from '@/components/ui/button';

type Assignment = {
  user_id: string;
  email: string;
  template: string;
};

type TemplateOption = {
  id: string;
  name: string;
};

export default function TemplateUserViewer() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [selected, setSelected] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const { data: map } = await supabase
      .from('dashboard_user_layouts')
      .select('user_id, template_id');

    const { data: users } = await supabase.from('auth.users').select('id, email');

    const { data: templateRows } = await supabase
      .from('dashboard_layout_templates')
      .select('id, name');

    const joined: Assignment[] =
      map?.map((row) => ({
        user_id: row.user_id,
        email: users?.find((u) => u.id === row.user_id)?.email || '—',
        template: templateRows?.find((t) => t.id === row.template_id)?.name || '(deleted)',
      })) || [];

    setAssignments(joined);
    setTemplates(templateRows || []);
  };

  const bulkAssign = async () => {
    const { data: users } = await supabase.from('auth.users').select('id');
    const inserts = users?.map((u) => ({
      user_id: u.id,
      template_id: selected,
    }));
    await supabase.from('dashboard_user_layouts').upsert(inserts || []);
    loadData();
    alert('All users assigned!');
  };

  return (
    <div className="p-4 border rounded bg-white shadow max-w-3xl mt-8">
      <h2 className="text-lg font-semibold mb-3">User → Template Assignments</h2>

      <div className="flex items-center gap-3 mb-4">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="border p-2 text-sm"
        >
          <option value="">Select template to assign all users</option>
          {templates.map((tpl) => (
            <option key={tpl.id} value={tpl.id}>
              {tpl.name}
            </option>
          ))}
        </select>
        <Button onClick={bulkAssign}>Assign to All Users</Button>
      </div>

      <table className="w-full text-sm border">
        <thead className="bg-gray-100">
          <tr>
            <th className="text-left p-2">User Email</th>
            <th className="text-left p-2">Template</th>
          </tr>
        </thead>
        <tbody>
          {assignments.map((a) => (
            <tr key={a.user_id} className="border-b">
              <td className="p-2">{a.email}</td>
              <td className="p-2">{a.template}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
