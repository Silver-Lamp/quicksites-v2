import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ViewsDashboard() {
  const [views, setViews] = useState<any[]>([]);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    supabase
      .from('snapshot_views')
      .select('*')
      .order('viewed_at', { ascending: false })
      .then(({ data, error }) => {
        if (data) setViews(data);
        else console.error(error);
      });
  }, []);

  const filtered = views.filter((v) =>
    v.template_name?.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Snapshot Views</h1>
      <Input
        placeholder="Filter by template name"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="mb-4 max-w-md"
      />
      <div className="rounded border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Template</TableHead>
              <TableHead>IP</TableHead>
              <TableHead>User Agent</TableHead>
              <TableHead>Viewed At</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((v) => (
              <TableRow key={v.id}>
                <TableCell>{v.template_name}</TableCell>
                <TableCell>{v.ip_address}</TableCell>
                <TableCell className="text-xs max-w-sm truncate">{v.user_agent}</TableCell>
                <TableCell className="text-xs">{new Date(v.viewed_at).toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
