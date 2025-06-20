import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Input } from '../../components/admin/ui/input.jsx';
import TagFilterDropdown from '../../components/admin/templates/TagFilterDropdown.jsx';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/admin/ui/table.jsx';
import { Button } from '../../components/admin/ui/button.jsx';
import SafeLink from '../../components/admin/ui/SafeLink.jsx';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function TemplatesAdminPage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [filter, setFilter] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  useEffect(() => {
    supabase
      .from('templates')
      .select('*')
      .then(({ data, error }) => {
        if (data) setTemplates(data);
        else console.error(error);
      });
  }, []);

  const filtered = templates.filter((t) => {
    const matchesSearch = t.template_name?.toLowerCase().includes(filter.toLowerCase());
    const matchesTags =
      tags.length === 0 || (t.tags || []).some((tag: string) => tags.includes(tag));
    return matchesSearch && matchesTags;
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Templates</h1>

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
              <TableHead>Name</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((t) => (
              <TableRow key={t.template_name}>
                <TableCell>{t.template_name}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {(t.tags || []).join(', ')}
                </TableCell>
                <TableCell>
                  <SafeLink href={`/admin/templates/${encodeURIComponent(t.template_name)}`}>
                    <Button size="sm" variant="outline">
                      Edit
                    </Button>
                  </SafeLink>
                  {t.domain && (
                    <SafeLink href={`/sites/${t.domain}`} className="text-blue-500 underline">
                      <Button size="sm" variant="ghost">
                        🌐 View Live
                      </Button>
                    </SafeLink>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
