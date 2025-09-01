'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Loader2, ArrowLeftRight } from 'lucide-react';

type SnapshotInfo = { id: string; rev: number; hash?: string; createdAt: string; note?: string };

export function TemplateDiffModal({
  open,
  onOpenChange,
  templateId,
  snapshots,
  initialTarget, // optional: snapshotId or eventId; if snapshotId, we'll use it on the right
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  templateId: string;
  snapshots: SnapshotInfo[];
  initialTarget?: string;
}) {
  const [left, setLeft] = useState<string>('draft');
  const [right, setRight] = useState<string>('published');
  const [loading, setLoading] = useState(false);
  const [diff, setDiff] = useState<{ summary: any; changes: any[]; leftRef: string; rightRef: string } | null>(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    // if opening from a snapshot click, compare draft -> that snapshot by default
    if (open && initialTarget && initialTarget !== 'draft' && initialTarget !== 'published') {
      setLeft('draft');
      setRight(initialTarget);
      setDiff(null);
    }
  }, [open, initialTarget]);

  const doDiff = async () => {
    setLoading(true);
    setDiff(null);
    const params = new URLSearchParams({ templateId, a: left, b: right });
    const res = await fetch(`/api/templates/diff?${params.toString()}`, { cache: 'no-store' });
    const json = await res.json();
    setDiff(json);
    setLoading(false);
  };

  const filteredChanges = useMemo(() => {
    if (!diff?.changes) return [];
    if (!filter) return diff.changes;
    return diff.changes.filter((c: any) => c.path.toLowerCase().includes(filter.toLowerCase()));
  }, [diff, filter]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            JSON Diff <ArrowLeftRight className="h-4 w-4" />
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs mb-1">Left (baseline)</div>
            <Select value={left} onValueChange={setLeft}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                {snapshots.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    snap {s.rev} · {s.hash?.slice(0, 7) ?? ''} · {new Date(s.createdAt).toLocaleString()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-xs mb-1">Right (compare)</div>
            <Select value={right} onValueChange={setRight}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                {snapshots.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    snap {s.rev} · {s.hash?.slice(0, 7) ?? ''} · {new Date(s.createdAt).toLocaleString()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={doDiff} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Compare
          </Button>
          {diff?.summary && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[11px]">+ {diff.summary.added}</Badge>
              <Badge variant="outline" className="text-[11px]">~ {diff.summary.changed}</Badge>
              <Badge variant="outline" className="text-[11px]">- {diff.summary.removed}</Badge>
              {diff.summary.limited ? <Badge variant="secondary" className="text-[11px]">truncated</Badge> : null}
            </div>
          )}
          <div className="ml-auto">
            <Input placeholder="filter by path…" value={filter} onChange={(e) => setFilter(e.target.value)} />
          </div>
        </div>

        <Separator />

        <ScrollArea className="h-[45vh] rounded-md border">
          <ul className="divide-y">
            {diff && filteredChanges.length === 0 && (
              <li className="p-3 text-sm text-muted-foreground">No differences (or filtered out).</li>
            )}
            {filteredChanges.map((c: any, i: number) => (
              <li key={i} className="p-3 text-sm">
                <div className="mb-1 flex items-center gap-2">
                  <Badge variant={c.type === 'changed' ? 'default' : c.type === 'added' ? 'secondary' : 'outline'} className="text-[11px]">
                    {c.type}
                  </Badge>
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{c.path}</code>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <pre className="overflow-auto rounded bg-muted/60 p-2">{JSON.stringify(c.before, null, 2)}</pre>
                  <pre className="overflow-auto rounded bg-muted/60 p-2">{JSON.stringify(c.after, null, 2)}</pre>
                </div>
              </li>
            ))}
          </ul>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
