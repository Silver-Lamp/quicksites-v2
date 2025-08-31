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

function baseSlug(slug: string | null | undefined) {
  if (!slug) return '';
  // strip trailing -[a-z0-9]{2,12} chunks
  return slug.replace(/(-[a-z0-9]{2,12})+$/i, '');
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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
    window.dispatchEvent(new Event('templates:overlay:show'));
    setLoading(true);
    try {
      const res = await fetch(`/api/templates/duplicate?slug=${encodeURIComponent(slug)}`, {
        method: 'POST',
      });
      if (!res.ok) {
        const msg = await res.text();
        window.dispatchEvent(new Event('templates:overlay:hide'));
        toast.error(`Duplicate failed${msg ? `: ${msg}` : ''}`);
        return;
      }
      const json = await res.json();
      toast.success('Template duplicated!');
      if (json?.slug) {
        router.push(`/template/${json.slug}/edit`);
      } else {
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

  // --- NEW: Rename Base (move entire family to a new base_slug) ---
  const handleRenameBase = async () => {
    const oldBase = baseSlug(slug);
    if (!oldBase) {
      toast.error('Could not infer base slug from this row.');
      return;
    }

    const suggested = `${oldBase}-old`;
    const newBase = window.prompt(
      `Rename base (moves ALL versions/canonical sharing base "${oldBase}"):\n\nEnter new base slug:`,
      suggested
    )?.trim();

    if (!newBase) return; // cancelled
    if (newBase === oldBase) {
      toast('Base unchanged.');
      return;
    }
    if (!SLUG_RE.test(newBase)) {
      toast.error('Invalid slug. Use lowercase letters, numbers, and dashes only.');
      return;
    }

    // Optional: also rewrite individual slugs to start with the new base?
    const rewrite = window.confirm(
      `Also rewrite each template's slug prefix from "${oldBase}" → "${newBase}"?\n\n(Choose “OK” to rewrite slugs, or “Cancel” to only move the base group.)`
    );

    try {
      setLoading(true);
      const res = await fetch('/api/admin/templates/rename-base', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          old_base: oldBase,
          new_base: newBase,
          rename_slugs: rewrite,
        }),
      });
      const j = await res.json().catch(() => ({} as any));

      if (!res.ok || !j.ok) {
        throw new Error(j?.error || 'Rename failed');
      }

      toast.success('Base renamed successfully.');
      // Server route should refresh MV + revalidate; still refresh client router just in case.
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message || 'Rename failed');
    } finally {
      setLoading(false);
    }
  };

  // (Optional quick action) Make this row’s *base* the family base directly
  const handleMakeThisBase = async () => {
    const oldBase = baseSlug(slug);
    const newBase = baseSlug(slug); // using the base of this slug as the new base
    if (!newBase) {
      toast.error('Could not infer base slug.');
      return;
    }
    if (newBase === oldBase) {
      // already aligned; nothing to do
      toast('Already the family base.');
      return;
    }
    // In most cases oldBase === newBase; keep just in case you alter logic later.
    try {
      setLoading(true);
      const res = await fetch('/api/admin/templates/rename-base', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          old_base: oldBase,
          new_base: newBase,
          rename_slugs: false,
        }),
      });
      const j = await res.json().catch(() => ({} as any));
      if (!res.ok || !j.ok) throw new Error(j?.error || 'Move failed');
      toast.success('Family moved to this base.');
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message || 'Move failed');
    } finally {
      setLoading(false);
    }
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

        {/* New actions */}
        <DropdownMenuItem onClick={handleRenameBase}>
          Rename Base…
        </DropdownMenuItem>
        {/* If you prefer fewer items, you can remove this helper action */}
        {/* <DropdownMenuItem onClick={handleMakeThisBase}>
          Make This the Base
        </DropdownMenuItem> */}

        <DropdownMenuItem onClick={handleArchiveClick}>
          {archived ? 'Restore' : 'Archive'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
