// components/admin/templates/truth/Timeline.tsx
'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  GitCommit,
  GitBranch,
  Save as SaveIcon,
  Rocket,
  HardDriveDownload,
  History,
  RotateCcw,
} from 'lucide-react';
import clsx from 'clsx';
import { shortTime, getSnapshotIdFromEvent, getVersionIdFromEvent } from './utils';
import type { TemplateEvent } from './types';
import { diffBlocks, type BlockDiff } from '@/lib/diff/blocks';

/* -------- tiny helpers for counts ---------- */
const sumCounts = (m?: Record<string, number>) =>
  Object.values(m ?? {}).reduce((a, b) => a + (Number.isFinite(b) ? (b as number) : 0), 0);

function iconForEvent(t: TemplateEvent['type']) {
  switch (t) {
    case 'save':
      return { icon: <SaveIcon className="h-4 w-4" />, tone: 'blue', label: 'save' } as const;
    case 'autosave':
      return { icon: <History className="h-4 w-4" />, tone: 'gray', label: 'autosave' } as const;
    case 'snapshot':
      return { icon: <HardDriveDownload className="h-4 w-4" />, tone: 'green', label: 'snapshot' } as const;
    case 'publish':
      return { icon: <Rocket className="h-4 w-4" />, tone: 'orange', label: 'publish' } as const;
    case 'open':
    default:
      return { icon: <GitCommit className="h-4 w-4" />, tone: 'gray', label: t } as const;
  }
}

export function Timeline({
  events,
  publishedSnapshotId,
  onViewDiff,
  onPublish,
  onRestore,
}: {
  events: TemplateEvent[];
  publishedSnapshotId?: string;
  onViewDiff?: (id: string) => void;
  onPublish?: (snapshotId: string) => void;
  onRestore?: (id: string) => void;
}) {
  return (
    <Card className="flex h-full min-h-40 flex-col border-neutral-200">
      <CardHeader className="py-3">
        <CardTitle className="text-sm">History</CardTitle>
      </CardHeader>
      <CardContent className="h-full p-0">
        <ScrollArea className="h-[42vh] w-full">
          <ul className="relative mx-3 my-2">
            <div className="absolute left-4 top-0 h-full w-px bg-border" />
            {events.length === 0 && (
              <li className="px-3 py-2 text-xs text-muted-foreground">No events yet.</li>
            )}
            {events.map((evt, idx) => (
              <TimelineItem
                key={evt.id ?? `${evt.type}-${idx}`}
                evt={evt}
                prevEvt={events[idx + 1]}
                onViewDiff={onViewDiff}
                onPublish={onPublish}
                onRestore={onRestore}
                publishedSnapshotId={publishedSnapshotId}
              />
            ))}
          </ul>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function TimelineItem({
  evt,
  prevEvt,
  onViewDiff,
  onPublish,
  onRestore,
  publishedSnapshotId,
}: {
  evt: TemplateEvent;
  prevEvt?: TemplateEvent;
  onViewDiff?: (id: string) => void;
  onPublish?: (snapshotId: string) => void;
  onRestore?: (id: string) => void;
  publishedSnapshotId?: string;
}) {
  const { icon, tone, label } = iconForEvent(evt.type);
  const rev = evt.revAfter ?? evt.revBefore;
  const coarse = evt.diff || { added: 0, changed: 0, removed: 0 };

  // Compute BlockDiff best-effort, then totals from maps
  const blockDiff: BlockDiff | undefined = useMemo(() => {
    const m = (evt.meta as any) || {};
    if (m.blockDiff) return m.blockDiff as BlockDiff;

    const before =
      (m.before?.data ?? m.dataBefore) ??
      ((prevEvt?.meta as any)?.data ?? (prevEvt?.meta as any)?.snapshot?.data);
    const after = (m.after?.data ?? m.dataAfter ?? m.data) ?? m.snapshot?.data;

    if (before && after) {
      try {
        return diffBlocks(before, after);
      } catch {
        /* ignore */
      }
    }
    return undefined;
  }, [evt.meta, prevEvt?.meta]);

  const totals = useMemo(() => {
    if (!blockDiff) {
      return { add: coarse.added ?? 0, mod: coarse.changed ?? 0, rem: coarse.removed ?? 0 };
    }
    return {
      add: sumCounts((blockDiff as any).addedByType),
      mod: sumCounts((blockDiff as any).modifiedByType),
      rem: sumCounts((blockDiff as any).removedByType),
    };
  }, [blockDiff, coarse]);

  const snapId = useMemo(() => getSnapshotIdFromEvent(evt), [evt.meta]);
  const verId = useMemo(() => getVersionIdFromEvent(evt), [evt.meta]);
  const isLive = !!(publishedSnapshotId && snapId && publishedSnapshotId === snapId);

  const [busy, setBusy] = useState(false);
  const doPublish = async () => {
    if (!snapId || !onPublish || busy) return;
    setBusy(true);
    try {
      await onPublish(snapId);
    } finally {
      setBusy(false);
    }
  };
  const doRestore = async () => {
    const id = verId || snapId;
    if (!id || !onRestore || busy) return;
    setBusy(true);
    try {
      await onRestore(id);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="relative flex gap-3 pl-8 pr-2 py-2">
      <span
        className={clsx(
          'absolute left-3 top-2.5 inline-flex h-2.5 w-2.5 -translate-x-1/2 rounded-full border',
          tone === 'green' && 'bg-emerald-500 border-emerald-600',
          tone === 'blue' && 'bg-blue-500 border-blue-600',
          tone === 'orange' && 'bg-amber-500 border-amber-600',
          tone === 'gray' && 'bg-muted border-border',
        )}
      />
      <div className="flex w-full items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="inline-flex items-center gap-1">
              {icon}
              <span className="font-medium capitalize">{label}</span>
            </span>
            {typeof rev === 'number' && (
              <Badge variant="outline" className="text-[11px]">
                rev {rev}
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">{shortTime(evt.at)}</span>
          </div>

          <div className="mt-1 text-[11px] text-muted-foreground">
            +{totals.add} ~{totals.mod} -{totals.rem}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onViewDiff && (
            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => onViewDiff(evt.id)}>
              <GitBranch className="h-4 w-4" />
            </Button>
          )}
          {snapId && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 gap-1"
                disabled={busy}
                onClick={doRestore}
                title="Restore draft to this point"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Restore
              </Button>
              <Button
                size="sm"
                variant={isLive ? 'secondary' : 'default'}
                className="h-7 px-2 gap-1"
                disabled={busy}
                onClick={doPublish}
                title="Publish this snapshot"
              >
                <Rocket className="h-3.5 w-3.5" />
                {isLive ? 'Published' : 'Publish'}
              </Button>
            </>
          )}
        </div>
      </div>
    </li>
  );
}
