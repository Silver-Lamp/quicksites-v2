// components/admin/templates/truth/TemplateTruthTracker.tsx
'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import CollapsiblePanel from '@/components/ui/collapsible-panel';
import { RefreshCw } from 'lucide-react';

import { useTruthData } from './hooks/useTruthData';
import { InfoDropdown } from './InfoDropdown';
import { InfraMap } from './InfraMap';
import { Timeline } from './Timeline';
import { shortHash } from './utils';
import type { TruthTrackerProps, TemplateEvent } from './types';

export default function TemplateTruthTracker({
  templateId,
  infra,
  snapshots,
  versions = [],
  events,
  selectedSnapshotId,
  onCreateSnapshot,
  onPublish,
  onRestore,
  onRefresh,
  onViewDiff,
  fileRefs,
  terms,
  readmeSummary,
  adminMeta,
  className,
}: TruthTrackerProps) {
  const {
    infra: effInfra,
    snapshots: effSnapshots,
    effectiveEvents,
    timelineOpen,
    setTimelineOpen,
    refreshTruth,
    createSnapshot,
    publishSnapshot,
    restoreTo,
  } = useTruthData(templateId);

  const publishedId = effInfra?.site?.publishedSnapshotId;
  const snaps = effSnapshots ?? [];
  const latestSnapshot = snaps[0];

  const [selectedSnap, setSelectedSnap] = useState<string | undefined>(selectedSnapshotId);
  const selected = useMemo(
    () => snaps.find(s => s.id === (selectedSnap || selectedSnapshotId)) ?? latestSnapshot,
    [snaps, selectedSnap, selectedSnapshotId, latestSnapshot]
  );

  const _create = onCreateSnapshot ?? createSnapshot;
  const _publish = onPublish ?? publishSnapshot;
  const _restore = onRestore ?? restoreTo;

  const info = {
    fileRefs: fileRefs && fileRefs.length ? fileRefs : [
      'components/admin/templates/truth/TemplateTruthTracker.tsx',
      'components/admin/templates/truth/Timeline.tsx',
      'components/admin/templates/truth/InfraMap.tsx',
      'components/admin/templates/truth/hooks/useTruthData.ts',
      'app/api/templates/state/route.ts',
      'app/api/templates/[id]/history/route.ts',
      'app/api/admin/snapshots/create/route.ts',
      'app/api/admin/sites/publish/route.ts',
    ],
    terms: terms && terms.length ? terms : [
      { term: 'Draft', def: 'Editable source at templates.data (with rev).' },
      { term: 'Snapshot', def: 'Immutable capture used for publish.' },
      { term: 'Publish', def: 'Live site reads snapshot, not draft.' },
    ],
    readmeSummary: readmeSummary || 'Draft → Snapshot → Publish. Renderer reads snapshot-only.',
  };

  const hasSnapshots = snaps.length > 0;

  return (
    <div className={className}>
      {/* Header */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[11px]">
            DRAFT · rev {effInfra?.template.rev ?? 0}
          </Badge>
          {effInfra?.template.hash && (
            <Badge variant="secondary" className="text-[11px]">{shortHash(effInfra.template.hash)}</Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <InfoDropdown {...info} templateId={templateId} />
          <Button size="icon" variant="ghost" onClick={onRefresh ?? refreshTruth} aria-label="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Timeline */}
      <CollapsiblePanel id="timeline" title="Timeline" defaultOpen={false} lazyMount onOpenChange={setTimelineOpen}>
        {({ open }) => (!open ? null : (
          <Timeline
            templateId={templateId}
            events={effectiveEvents as unknown as TemplateEvent[]}
            publishedSnapshotId={publishedId as string}
            onViewDiff={onViewDiff}
            onPublish={_publish}
            onRestore={_restore}
          />
        ))}
      </CollapsiblePanel>

      {/* Infra Map */}
      <CollapsiblePanel id="infra-map" title="Infra Map" defaultOpen={false} lazyMount>
        {({ open }) => (!open ? null : (
          <InfraMap
            draft={{ rev: effInfra?.template.rev ?? 0, hash: effInfra?.template.hash as string }}
            latestSnapshot={effInfra?.lastSnapshot as { id?: string; rev?: number; hash?: string; createdAt?: string } ?? {
              id: latestSnapshot?.id,
              rev: latestSnapshot?.rev,
              hash: latestSnapshot?.hash as string,
              createdAt: latestSnapshot?.createdAt,
            }}
            publishedSnapshotId={publishedId as string}
            siteSlug={effInfra?.site?.slug as string}
            cacheInfo={effInfra?.cache}
          />
        ))}
      </CollapsiblePanel>

      {/* Snapshots & Actions */}
      <CollapsiblePanel id="snapshot-picker" title="Snapshot Picker + Actions" defaultOpen={false} lazyMount>
        <Card className="border-neutral-200">
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Snapshots & Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <select
                className="w-full rounded-md border bg-background px-2 py-1 text-sm"
                value={selected?.id ?? ''}
                onChange={(e) => setSelectedSnap(e.target.value)}
                disabled={!hasSnapshots}
              >
                {snaps.map(s => (
                  <option key={s.id} value={s.id}>
                    {shortHash(s.hash as string)} · rev {s.rev} · {s.createdAt ? new Date(s.createdAt).toLocaleString() : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="default" onClick={_create} className="gap-1">
                Create Snapshot
              </Button>
              <Button
                size="sm"
                variant={selected?.id && selected?.id === publishedId ? 'secondary' : 'default'}
                disabled={!selected?.id}
                className="gap-1"
                onClick={() => selected?.id && _publish(selected.id)}
              >
                {selected?.id === publishedId ? 'Published' : 'Publish'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </CollapsiblePanel>
    </div>
  );
}
