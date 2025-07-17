'use client';

import { useState, useMemo } from 'react';
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

type Template = {
  id: string;
  template_name: string;
  slug: string;
  updated_at: string;
  banner_url?: string | null;
  status?: 'draft' | 'published' | null;
  is_site?: boolean;
  published?: boolean;
};

const dateOptions = ['Last 7 days', 'This month', 'This year', 'All time'];

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
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [renames, setRenames] = useState<Record<string, string>>({});

  const filtered = useMemo(() => {
    return templates
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
  }, [templates, search, viewMode]);

  const handleFilterChange = (option: string) => {
    const url = new URL(window.location.href);
    if (option === 'All time') {
      url.searchParams.delete('date');
    } else {
      url.searchParams.set('date', option);
    }
    setCurrentFilter(option);
    router.push(url.toString());
  };

  const handleRename = useMemo(
    () =>
      debounce(async (id: string, newName: string) => {
        const res = await fetch('/api/templates/rename', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ template_id: id, newName }),
        });
        if (res.ok) {
          toast.success('Template renamed!');
        } else {
          toast.error('Failed to rename template');
        }
      }, 400),
    []
  );

  const handleDuplicate = async (slug: string) => {
    const res = await fetch(`/api/templates/duplicate?slug=${slug}`, {
      method: 'POST',
    });
    if (res.ok) {
      toast.success('Template duplicated!');
      router.refresh();
    } else {
      toast.error('Duplicate failed');
    }
  };

  const handleExport = async (id: string) => {
    const res = await fetch(`/api/templates/export?id=${id}`);
    if (!res.ok) return toast.error('Export failed');

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `template-${id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 justify-between items-center">
        <div className="text-lg font-semibold text-white">Templates</div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* View Toggle Buttons */}
          <div className="flex gap-1 text-xs">
            <Button
              variant={viewMode === 'all' ? 'default' : 'outline'}
              onClick={() => setViewMode('all')}
            >
              All
            </Button>
            <Button
              variant={viewMode === 'templates' ? 'default' : 'outline'}
              onClick={() => setViewMode('templates')}
            >
              Templates
            </Button>
            <Button
              variant={viewMode === 'sites' ? 'default' : 'outline'}
              onClick={() => setViewMode('sites')}
            >
              Sites
            </Button>
          </div>

          {/* Search + Date Filter */}
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or slug..."
            className="text-sm w-64"
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="text-xs">
                {currentFilter || 'Filter by Date'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {dateOptions.map((option) => (
                <DropdownMenuItem key={option} onClick={() => handleFilterChange(option)}>
                  {option}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="border border-white/10 rounded overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-zinc-900 text-white text-left">
              <th className="p-2 text-right">Actions</th>
              <th className="p-2 text-right">Type</th>
              <th className="p-2 w-[60px]">Preview</th>
              <th className="p-2">Name</th>
              <th className="p-2">Slug</th>
              <th className="p-2">Published</th>
              <th className="p-2">Updated</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.id} className="border-t border-white/10 hover:bg-zinc-800 transition">
                <td className="p-2 text-right space-x-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => router.push(`/template/${t.slug}/edit`)}
                  >
                    Edit
                  </Button>
                </td>
                <td className="p-2 text-right">
                  {t.is_site ? (
                    <Globe className="w-4 h-4 text-blue-400" />
                  ) : (
                    <FileStack className="w-4 h-4 text-blue-400" />
                  )}
                </td>
                <td className="p-2">
                  {t.banner_url ? (
                    <img
                      src={t.banner_url}
                      alt="preview"
                      className="w-12 h-8 rounded object-cover"
                    />
                  ) : (
                    <div className="w-12 h-8 bg-zinc-700 rounded flex items-center justify-center text-xs text-white/40">
                      N/A
                    </div>
                  )}
                </td>
                <td className="p-2">
                  {editingId === t.id ? (
                    <Input
                      value={renames[t.id] || t.template_name}
                      onChange={(e) => {
                        const value = e.target.value;
                        setRenames((prev) => ({ ...prev, [t.id]: value }));
                        handleRename(t.id, value);
                      }}
                      onBlur={() => setEditingId(null)}
                      className="text-xs"
                    />
                  ) : (
                    <button
                      className="text-white hover:underline text-left"
                      onClick={() => {
                        setEditingId(t.id);
                        setRenames((prev) => ({ ...prev, [t.id]: t.template_name }));
                      }}
                    >
                      {t.template_name}
                    </button>
                  )}
                </td>
                <td className="p-2 text-zinc-400">{t.slug}</td>
                <td className="p-2 text-zinc-400">
                  {t.published ? (
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400" />
                  )}
                </td>
                <td className="p-2 text-zinc-400">
                  {formatDistanceToNow(new Date(t.updated_at), { addSuffix: true })}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="p-4 text-center text-muted-foreground italic">
                  No matching templates.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
