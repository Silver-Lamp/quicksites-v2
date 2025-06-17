'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient.js';
import { Button } from '@/components/ui/button';
import { Template } from '@/types/template';

export default function TemplateUserViewer() {
  type Assignment = {
    user_id: string;
    email: string;
    template_id: string;
    template: string;
  };
  type TemplateOption = { id: string; name: string };
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [filtered, setFiltered] = useState<Assignment[]>([]);
  const [search, setSearch] = useState('');
  const [filterTemplate, setFilterTemplate] = useState('');
  const [selected, setSelected] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    setFiltered(
      assignments.filter(
        (a) =>
          (!search || a.email.toLowerCase().includes(search.toLowerCase())) &&
          (!filterTemplate || a.template === filterTemplate)
      )
    );
  }, [search, filterTemplate, assignments]);

  const loadData = async () => {
    const { data: map } = await supabase
      .from('dashboard_user_layouts')
      .select('user_id, template_id');

    const { data: users } = await supabase
      .from('auth.users')
      .select('id, email');

    const { data: templates } = await supabase
      .from('dashboard_layout_templates')
      .select('id, name');

    const joined =
      map?.map((row) => ({
        user_id: row.user_id,
        email: users?.find((u) => u.id === row.user_id)?.email || '—',
        template_id: row.template_id,
        template:
          templates?.find((t) => t.id === row.template_id)?.name || '(deleted)',
      })) || [];

    setAssignments(joined);
    setTemplates(templates || []);
    setFiltered(joined);
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

  const revertUser = async (user_id: string) => {
    await supabase
      .from('dashboard_user_layouts')
      .delete()
      .eq('user_id', user_id);
    loadData();
  };

  return (
    <div className="p-4 border rounded bg-white shadow max-w-3xl mt-8">
      <h2 className="text-lg font-semibold mb-3">
        User → Template Assignments
      </h2>

      <div className="flex flex-wrap gap-3 items-center mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search user email..."
          className="border p-2 text-sm"
        />
        <select
          value={filterTemplate}
          onChange={(e) => setFilterTemplate(e.target.value)}
          className="border p-2 text-sm"
        >
          <option value="">All templates</option>
          {templates.map((tpl) => (
            <option key={tpl.id} value={tpl.name}>
              {tpl.name}
            </option>
          ))}
        </select>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="border p-2 text-sm"
        >
          <option value="">Select template to assign all</option>
          {templates.map((tpl) => (
            <option key={tpl.id} value={tpl.id}>
              {tpl.name}
            </option>
          ))}
        </select>
        <Button onClick={bulkAssign}>Assign to All</Button>
      </div>

      <table className="w-full text-sm border">
        <thead className="bg-gray-100">
          <tr>
            <th className="text-left p-2">User Email</th>
            <th className="text-left p-2">Template</th>
            <th className="text-left p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((a) => (
            <tr key={a.user_id} className="border-b">
              <td className="p-2">{a.email}</td>
              <td className="p-2">{a.template}</td>
              <td className="p-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => revertUser(a.user_id)}
                >
                  Revert
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
