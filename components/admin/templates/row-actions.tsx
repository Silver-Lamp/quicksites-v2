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
    setLoading(true);
    const res = await fetch(`/api/templates/duplicate?slug=${slug}`, {
      method: 'POST',
    });
    setLoading(false);
    if (res.ok) {
      toast.success('Template duplicated!');
      router.refresh();
    } else {
      toast.error('Duplicate failed');
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
