"use client";

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'react-hot-toast';
import debounce from 'lodash.debounce';
import { CheckCircle, FileStack, Globe, XCircle } from 'lucide-react';
import { GSCStatusBadge } from '@/components/admin/gsc-status-badge';
import RowActions from '@/components/admin/templates/row-actions';
import { Template } from '@/types/template';
import { cn } from '@/lib/utils';

export default function TemplatesIndexTable({
  templates,
  selectedFilter = '',
}: {
  templates: Template[];
  selectedFilter?: string;
}) {
  const router = useRouter();
  const [currentFilter, setCurrentFilter] = useState(selectedFilter);
  const [viewMode, setViewMode] = useState<'all' | 'templates' | 'sites'>('all');
  const [archiveFilter, setArchiveFilter] = useState<'active' | 'archived' | 'all'>('active');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [renames, setRenames] = useState<Record<string, string>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [archivedIds, setArchivedIds] = useState<string[]>([]);
  const [restoredIds, setRestoredIds] = useState<string[]>([]);

  const filtered = useMemo(() => {
    return templates
      .filter((t) => {
        const isLocallyArchived = archivedIds.includes(t.id);
        const isArchived = t.archived || isLocallyArchived;

        if (archiveFilter === 'archived') return isArchived;
        if (archiveFilter === 'active') return !isArchived;
        return true; // 'all'
      })
      .filter((t) => {
        const term = search.toLowerCase();
        return (
          t.template_name.toLowerCase().includes(term) ||
          t.slug.toLowerCase().includes(term)
        );
      })
      .filter((t) => {
        if (viewMode === 'sites') return t.is_site === true;
        if (viewMode === 'templates') return !t.is_site;
        return true;
      });
  }, [templates, search, viewMode, archiveFilter, archivedIds]);

  const handleBulkArchive = async (ids: string[]) => {
    const res = await fetch('/api/templates/archive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, archived: true }),
    });

    if (res.ok) {
      setArchivedIds((prev) => [...prev, ...ids]);
      setSelectedIds([]);
      toast.success(`${ids.length} template${ids.length > 1 ? 's' : ''} archived`);
    } else {
      toast.error('Bulk archive failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 justify-between items-center">
        <div className="text-lg font-semibold text-white">Templates</div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 text-xs">
            <Button variant={viewMode === 'all' ? 'default' : 'outline'} onClick={() => setViewMode('all')}>All</Button>
            <Button variant={viewMode === 'templates' ? 'default' : 'outline'} onClick={() => setViewMode('templates')}>Templates</Button>
            <Button variant={viewMode === 'sites' ? 'default' : 'outline'} onClick={() => setViewMode('sites')}>Sites</Button>
          </div>
          <div className="flex gap-1 text-xs">
            <Button variant={archiveFilter === 'active' ? 'default' : 'outline'} onClick={() => setArchiveFilter('active')}>Active</Button>
            <Button variant={archiveFilter === 'archived' ? 'default' : 'outline'} onClick={() => setArchiveFilter('archived')}>Archived</Button>
            <Button variant={archiveFilter === 'all' ? 'default' : 'outline'} onClick={() => setArchiveFilter('all')}>All</Button>
          </div>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or slug..." className="text-sm w-64" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="text-xs">{currentFilter || 'Filter by Date'}</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {['Last 7 days', 'This month', 'This year', 'All time'].map((option) => (
                <DropdownMenuItem key={option} onClick={() => {
                  const url = new URL(window.location.href);
                  if (option === 'All time') url.searchParams.delete('date');
                  else url.searchParams.set('date', option);
                  setCurrentFilter(option);
                  router.push(url.toString());
                }}>{option}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="sticky top-0 z-10 bg-zinc-950 px-4 py-2 border-b border-white/10">
          <div className="flex justify-start">
            <Button variant="destructive" className="text-xs text-white bg-red-500 hover:bg-red-600" onClick={() => handleBulkArchive(selectedIds)}>
              Archive {selectedIds.length} selected
            </Button>
          </div>
        </div>
      )}

      <div className="border border-white/10 rounded overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-zinc-900 text-white text-left">
              <th className="p-2">
                <input
                  type="checkbox"
                  checked={filtered.length > 0 && selectedIds.length === filtered.length}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedIds(filtered.map((t) => t.id));
                    else setSelectedIds([]);
                  }}
                />
              </th>
              <th className="p-2 text-right">Actions</th>
              <th className="p-2 text-right">Type</th>
              <th className="p-2 w-[60px]">Preview</th>
              <th className="p-2">Name</th>
              <th className="p-2">Slug</th>
              <th className="p-2">Published</th>
              <th className="p-2">Updated</th>
              <th className="p-2">GSC</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.id} className={cn('border-t border-white/10 hover:bg-zinc-800 transition', t.archived && 'opacity-50 italic', restoredIds.includes(t.id) && 'animate-fadeIn')}>
                <td className="p-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(t.id)}
                    onChange={() => {
                      setSelectedIds((prev) =>
                        prev.includes(t.id) ? prev.filter((id) => id !== t.id) : [...prev, t.id]
                      );
                    }}
                  />
                </td>
                <td className="p-2 text-right">
                  <RowActions id={t.id} slug={t.slug} archived={t.archived} onArchiveToggle={(id, archived) => {
                    fetch('/api/templates/archive', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ ids: [id], archived }),
                    }).then((res) => {
                      if (res.ok) {
                        setArchivedIds((prev) => archived ? [...prev, id] : prev.filter((x) => x !== id));
                        setRestoredIds((prev) => archived ? prev : [...prev, id]);
                        toast.success(`Template ${archived ? 'archived' : 'restored'}`);
                      } else {
                        toast.error(`Failed to ${archived ? 'archive' : 'restore'} template`);
                      }
                    });
                  }} />
                </td>
                <td className="p-2 text-right">
                  {t.is_site ? <Globe className="w-4 h-4 text-blue-400" /> : <FileStack className="w-4 h-4 text-blue-400" />}
                </td>
                <td className="p-2">
                  {t.banner_url ? (
                    <img src={t.banner_url} alt="preview" className="w-12 h-8 rounded object-cover" />
                  ) : (
                    <div className="w-12 h-8 bg-zinc-700 rounded flex items-center justify-center text-xs text-white/40">N/A</div>
                  )}
                </td>
                <td className="p-2">
                  {editingId === t.id ? (
                    <Input
                      value={renames[t.id] || t.template_name}
                      onChange={(e) => {
                        const value = e.target.value;
                        setRenames((prev) => ({ ...prev, [t.id]: value }));
                        debounce(async () => {
                          const res = await fetch('/api/templates/rename', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ template_id: t.id, newName: value }),
                          });
                          if (!res.ok) toast.error('Failed to rename');
                        }, 400)();
                      }}
                      onBlur={() => setEditingId(null)}
                      className="text-xs"
                    />
                  ) : (
                    <button className="text-white hover:underline text-left" onClick={() => {
                      setEditingId(t.id);
                      setRenames((prev) => ({ ...prev, [t.id]: t.template_name }));
                    }}>{t.template_name}</button>
                  )}
                </td>
                <td className="p-2 text-zinc-400">{t.slug}</td>
                <td className="p-2 text-zinc-400">
                  {t.published ? <CheckCircle className="w-4 h-4 text-green-400" /> : <XCircle className="w-4 h-4 text-red-400" />}
                </td>
                <td className="p-2 text-zinc-400">
                  {t.updated_at ? formatDistanceToNow(new Date(t.updated_at), { addSuffix: true }) : 'N/A'}
                </td>
                <td className="p-2 text-zinc-400">
                  {t.custom_domain && <GSCStatusBadge domain={`https://${t.custom_domain}`} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
