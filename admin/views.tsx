import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Input } from '../components/admin/ui/input.jsx';
import TagFilterDropdown from '../components/admin/templates/TagFilterDropdown.jsx';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/admin/ui/table.jsx';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ViewsDashboard() {
  const [views, setViews] = useState<any[]>([]);
  const [filter, setFilter] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [templateTags, setTemplateTags] = useState<Record<string, string[]>>(
    {}
  );

  useEffect(() => {
    supabase
      .from('snapshot_views')
      .select('*')
      .order('viewed_at', { ascending: false })
      .then(({ data, error }) => {
        if (data) setViews(data);
        else console.error(error);
      });

    supabase
      .from('templates')
      .select('template_name, tags')
      .then(({ data }) => {
        if (data) {
          const tagMap: Record<string, string[]> = {};
          data.forEach((t) => {
            tagMap[t.template_name] = t.tags || [];
          });
          setTemplateTags(tagMap);
        }
      });
  }, []);

  const filtered = views.filter((v) => {
    const matchesSearch = v.template_name
      ?.toLowerCase()
      .includes(filter.toLowerCase());
    const matchesTags =
      tags.length === 0 ||
      (templateTags[v.template_name] || []).some((t) => tags.includes(t));
    return matchesSearch && matchesTags;
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Snapshot Views</h1>

      <Input
        placeholder="Filter by template name"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="max-w-md"
      />

      <TagFilterDropdown selected={tags} onChange={setTags} />

      <div className="rounded border overflow-x-auto mt-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Template</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead>IP</TableHead>
              <TableHead>User Agent</TableHead>
              <TableHead>Viewed At</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((v) => (
              <TableRow key={v.id}>
                <TableCell>{v.template_name}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {(templateTags[v.template_name] || []).join(', ')}
                </TableCell>
                <TableCell>{v.ip_address}</TableCell>
                <TableCell className="text-xs max-w-sm truncate">
                  {v.user_agent}
                </TableCell>
                <TableCell className="text-xs">
                  {new Date(v.viewed_at).toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
