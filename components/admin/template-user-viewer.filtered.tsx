'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { supabase } from '@/admin/lib/supabaseClient';
import { Button } from '@/components/ui';
import { useOrg } from '@/app/providers';

type Assignment = {
  user_id: string;
  email: string;
  template_id: string;
  template: string;
};
type TemplateOption = { id: string; name: string };

export default function TemplateUserViewer() {
  const org = useOrg(); // ← current org (tenant)
  const orgId = org.id;

  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [search, setSearch] = useState('');
  const [filterTemplate, setFilterTemplate] = useState('');
  const [selectedTemplateForBulk, setSelectedTemplateForBulk] = useState('');
  const [loading, setLoading] = useState(false);

  // Derived rows
  const filtered: Assignment[] = useMemo(() => {
    const s = search.trim().toLowerCase();
    return assignments.filter((a) => {
      const emailMatch = !s || a.email.toLowerCase().includes(s);
      const tplMatch = !filterTemplate || a.template === filterTemplate;
      return emailMatch && tplMatch;
    });
  }, [assignments, search, filterTemplate]);

  useEffect(() => {
    // Reload if org changes
    loadData().catch((e) => {
      console.error(e);
      toast.error('Failed to load assignments');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  async function loadData() {
    if (!orgId) return;

    setLoading(true);

    // 1) Fetch maps (user → template) for this org
    const { data: map, error: mapErr } = await supabase
      .from('dashboard_user_layouts')
      .select('user_id, template_id')
      .eq('org_id', orgId);

    if (mapErr) {
      setLoading(false);
      throw mapErr;
    }

    // 2) Fetch users (id, email). If your RLS blocks auth.users from client,
    //    swap this to a safe view (e.g., public.user_profiles).
    const { data: users, error: usersErr } = await supabase
      .from('auth.users' as any)
      .select('id, email');

    if (usersErr) {
      // Don’t hard fail; show “—” for emails if blocked.
      console.warn('auth.users not readable; using blank emails', usersErr);
    }

    // 3) Fetch templates available in this org
    const { data: tpls, error: tplsErr } = await supabase
      .from('dashboard_layout_templates')
      .select('id, name')
      .eq('org_id', orgId)
      .order('name', { ascending: true });

    if (tplsErr) {
      setLoading(false);
      throw tplsErr;
    }

    // Join
    const joined: Assignment[] =
      map?.map((row) => ({
        user_id: row.user_id,
        email:
          users?.find((u: any) => u.id === row.user_id)?.email ??
          '—',
        template_id: row.template_id,
        template:
          tpls?.find((t) => t.id === row.template_id)?.name ??
          '(deleted)',
      })) ?? [];

    setAssignments(joined);
    setTemplates(tpls ?? []);
    setLoading(false);
  }

  async function bulkAssign() {
    if (!orgId || !selectedTemplateForBulk) {
      return toast.error('Choose a template first.');
    }
    setLoading(true);

    // Fetch all users we want to assign
    const { data: users, error: usersErr } = await supabase
      .from('auth.users' as any)
      .select('id');

    if (usersErr || !users) {
      setLoading(false);
      return toast.error('Could not read users for bulk assign.');
    }

    // Build upsert rows with org_id
    const inserts =
      users.map((u: any) => ({
        org_id: orgId,
        user_id: u.id,
        template_id: selectedTemplateForBulk,
      })) ?? [];

    // If you have a unique index like (org_id, user_id), set onConflict accordingly
    const { error } = await supabase
      .from('dashboard_user_layouts')
      .upsert(inserts, { onConflict: 'org_id,user_id' });

    if (error) {
      setLoading(false);
      return toast.error(error.message);
    }

    await loadData();
    toast.success('Assigned to all users in this org.');
  }

  async function revertUser(user_id: string) {
    if (!orgId) return;
    setLoading(true);
    const { error } = await supabase
      .from('dashboard_user_layouts')
      .delete()
      .eq('org_id', orgId)
      .eq('user_id', user_id);

    if (error) {
      setLoading(false);
      return toast.error(error.message);
    }
    await loadData();
    toast.success('Reverted user to default.');
  }

  return (
    <div className="mt-8 max-w-3xl rounded border bg-white p-4 shadow">
      <div className="mb-1 text-xs text-gray-500">
        Organization: <span className="font-medium">{org.name}</span>
      </div>
      <h2 className="mb-3 text-lg font-semibold">User → Template Assignments</h2>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search user email…"
          className="rounded border p-2 text-sm"
        />

        <select
          value={filterTemplate}
          onChange={(e) => setFilterTemplate(e.target.value)}
          className="rounded border p-2 text-sm"
        >
          <option value="">All templates</option>
          {templates.map((tpl) => (
            <option key={tpl.id} value={tpl.name}>
              {tpl.name}
            </option>
          ))}
        </select>

        <select
          value={selectedTemplateForBulk}
          onChange={(e) => setSelectedTemplateForBulk(e.target.value)}
          className="rounded border p-2 text-sm"
        >
          <option value="">Select template to assign all</option>
          {templates.map((tpl) => (
            <option key={tpl.id} value={tpl.id}>
              {tpl.name}
            </option>
          ))}
        </select>

        <Button onClick={bulkAssign} disabled={loading || !selectedTemplateForBulk}>
          {loading ? 'Working…' : 'Assign to All'}
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left">User Email</th>
              <th className="p-2 text-left">Template</th>
              <th className="p-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <tr key={`${a.user_id}-${a.template_id}`} className="border-b">
                <td className="p-2">{a.email}</td>
                <td className="p-2">{a.template}</td>
                <td className="p-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => revertUser(a.user_id)}
                    disabled={loading}
                  >
                    Revert
                  </Button>
                </td>
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr>
                <td className="p-4 text-center text-gray-500" colSpan={3}>
                  No assignments found.
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td className="p-4 text-center text-gray-500" colSpan={3}>
                  Loading…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
