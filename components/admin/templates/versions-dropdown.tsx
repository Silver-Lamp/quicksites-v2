// components/admin/templates/versions-dropdown.tsx
'use client';

import * as React from 'react';
import { useMemo, useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuGroup,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ChevronDown,
  PlusCircle,
  Rocket,
  RotateCcw,
  Tag,
  Clock,
  ExternalLink,
} from 'lucide-react';

type VersionRow = {
  id: string;                 // version id OR snapshot id (fallback)
  tag?: string | null;        // human-friendly tag if this is a “version”
  snapshot_id?: string | null;// underlying snapshot id (if available)
  commit?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export default function VersionsDropdown({
  labelTitle,
  versions,
  open,
  setOpen,
  onCreateSnapshot,
  onRestore,
  onPublish,
  publishedVersionId = null,
  publishedSnapshotId = null, // NEW (optional)
  baseSlug,
  domain,
  defaultSubdomain,
  onOpenPageSettings,
}: {
  labelTitle: string;
  versions: VersionRow[];
  open: boolean;
  setOpen: (v: boolean) => void;
  onCreateSnapshot: () => Promise<string | void> | void;
  onRestore: (id: string) => void;
  onPublish: (snapshotId?: string) => void;
  publishedVersionId?: string | null;
  publishedSnapshotId?: string | null;
  baseSlug?: string;
  domain?: string | null;
  defaultSubdomain?: string | null;
  onOpenPageSettings?: () => void;
}) {
  const [busy, setBusy] = useState(false);

  // sort newest-first by updated/created
  const list = useMemo(() => {
    const sorted = [...(versions || [])];
    sorted.sort((a, b) => {
      const at = new Date(a.updated_at || a.created_at || 0).getTime();
      const bt = new Date(b.updated_at || b.created_at || 0).getTime();
      return bt - at;
    });
    return sorted;
  }, [versions]);

  const publishLabel = busy ? 'Working…' : 'Publish';
  const createLabel = busy ? 'Working…' : 'Create snapshot';

  const doCreateSnapshot = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const id = (await onCreateSnapshot()) as string | void;
      if (id) {
        safeTruthRefresh();
      }
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  const doPublishLatest = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await Promise.resolve(onPublish(undefined)); // toolbar will snapshot if needed
      safeTruthRefresh();
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  const doPublishSpecific = async (snapId?: string | null) => {
    if (busy) return;
    setBusy(true);
    try {
      await Promise.resolve(onPublish(snapId || undefined));
      safeTruthRefresh();
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  const doRestore = async (id: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await Promise.resolve(onRestore(id));
      safeTruthRefresh();
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  const liveUrl = useMemo(() => {
    if (domain) return `https://${domain}`;
    if (defaultSubdomain) return `https://${defaultSubdomain}`;
    if (baseSlug) return `https://${baseSlug}.quicksites.ai`;
    return null;
  }, [domain, defaultSubdomain, baseSlug]);

  const pubMatch = (row: VersionRow) => {
    // Prefer snapshot comparison; fallback to version id
    const sid = row.snapshot_id ?? null;
    if (publishedSnapshotId && sid) return sid === publishedSnapshotId;
    if (publishedVersionId) return row.id === publishedVersionId;
    return false;
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" className="gap-2">
          <span className="truncate max-w-[24ch]" title={labelTitle}>{labelTitle}</span>
          <ChevronDown className="h-4 w-4 opacity-70" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-[360px] p-0">
        <div className="px-3 pt-3 pb-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Versions & Publishing</div>
            {liveUrl && (
              <a href={liveUrl} target="_blank" rel="noreferrer" className="text-xs inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
                Live <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </div>

        <DropdownMenuSeparator />

        <div className="px-3 py-2 flex items-center gap-2">
          <Button size="sm" className="gap-1" disabled={busy} onClick={doCreateSnapshot}>
            <PlusCircle className="h-4 w-4" />
            {createLabel}
          </Button>
          <Button size="sm" variant="secondary" className="gap-1" disabled={busy} onClick={doPublishLatest}>
            <Rocket className="h-4 w-4" />
            {publishLabel}
          </Button>
          {onOpenPageSettings && (
            <Button size="sm" variant="ghost" onClick={() => { setOpen(false); onOpenPageSettings(); }}>
              Page settings
            </Button>
          )}
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuLabel className="text-xs px-3 py-2 flex items-center gap-2">
          <Clock className="h-3.5 w-3.5" />
          History
        </DropdownMenuLabel>

        <DropdownMenuGroup>
          <ScrollArea className="max-h-[42vh]">
            <ul className="px-1 pb-2">
              {list.length === 0 && (
                <li className="px-3 py-2 text-xs text-muted-foreground">No versions yet—create a snapshot to get started.</li>
              )}
              {list.map((v) => {
                const ts = v.updated_at || v.created_at || '';
                const rel = ts ? relTime(ts) : '';
                const isLive = pubMatch(v);
                const snapId = v.snapshot_id ?? null;

                return (
                  <li key={v.id} className="px-3 py-2 hover:bg-muted/50 rounded-md">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-sm">
                          {v.tag ? (
                            <>
                              <Tag className="h-3.5 w-3.5 opacity-70" />
                              <span className="truncate max-w-[20ch]">{v.tag}</span>
                            </>
                          ) : (
                            <>
                              <span className="font-mono text-xs opacity-80">{shortId(v.id)}</span>
                            </>
                          )}
                          {isLive && <Badge variant="secondary" className="h-5">Published</Badge>}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {v.commit ? v.commit : 'Snapshot'} · {rel}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="outline" className="h-7 px-2 gap-1" disabled={busy} onClick={() => doRestore(v.id)}>
                          <RotateCcw className="h-3.5 w-3.5" />
                          Restore
                        </Button>
                        <Button
                          size="sm"
                          variant={isLive ? 'secondary' : 'default'}
                          className="h-7 px-2 gap-1"
                          disabled={busy}
                          onClick={() => doPublishSpecific(snapId)}
                          title={snapId ? 'Publish this snapshot' : 'Publish (will snapshot if needed)'}
                        >
                          <Rocket className="h-3.5 w-3.5" />
                          {isLive ? 'Published' : 'Publish'}
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ===== helpers ===== */
function shortId(s?: string | null) {
  if (!s) return '';
  return s.length <= 8 ? s : s.slice(0, 8);
}
function relTime(iso: string) {
  const d = new Date(iso).getTime();
  const s = Math.max(1, Math.floor((Date.now() - d) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
function safeTruthRefresh() {
  try { window.dispatchEvent(new CustomEvent('qs:truth:refresh')); } catch {}
}
