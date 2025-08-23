// components/admin/templates/row-actions.tsx
'use client';

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { useState } from 'react';

type RowActionsProps = {
  id: string;
  slug: string;
  archived?: boolean;
  onArchiveToggle?: (id: string, archived: boolean) => void;
};

export default function RowActions({ id, slug, archived = false, onArchiveToggle }: RowActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    const res = await fetch(`/api/templates/export?id=${id}`);
    setLoading(false);
    if (!res.ok) return toast.error('Export failed');

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `template-${id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDuplicate = async () => {
    // show the full-screen overlay right away
    window.dispatchEvent(new Event('templates:overlay:show'));
    setLoading(true);
  
    try {
      const res = await fetch(`/api/templates/duplicate?slug=${encodeURIComponent(slug)}`, {
        method: 'POST',
      });
  
      if (!res.ok) {
        const msg = await res.text();
        window.dispatchEvent(new Event('templates:overlay:hide')); // hide on failure
        toast.error(`Duplicate failed${msg ? `: ${msg}` : ''}`);
        return;
      }
  
      const json = await res.json();
      toast.success('Template duplicated!');
  
      // Keep the overlay shown; it will auto-hide on route change in the list page.
      if (json?.slug) {
        router.push(`/template/${json.slug}/edit`);
      } else {
        // If we *don’t* navigate, hide it ourselves and just refresh.
        window.dispatchEvent(new Event('templates:overlay:hide'));
        router.refresh();
      }
    } catch (e: any) {
      window.dispatchEvent(new Event('templates:overlay:hide'));
      toast.error(`Duplicate failed: ${e?.message ?? 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleArchiveClick = () => {
    if (!onArchiveToggle) return;
    onArchiveToggle(id, !archived);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="ghost" disabled={loading}>
          ⋮
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => router.push(`/template/${slug}/edit`)}>
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDuplicate}>Duplicate</DropdownMenuItem>
        <DropdownMenuItem onClick={handleExport}>Export</DropdownMenuItem>
        <DropdownMenuItem onClick={handleArchiveClick}>
          {archived ? 'Restore' : 'Archive'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
