// components/admin/templates/truth/InfraMap.tsx
'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Eye, Database, Box, Rocket, Save, HardDriveDownload, Link as LinkIcon } from 'lucide-react';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import { shortHash, shortTime } from './utils';

export function InfraMap({
  draft,
  latestSnapshot,
  publishedSnapshotId,
  siteSlug,
  cacheInfo,
}: {
  draft: { rev: number; hash?: string };
  latestSnapshot?: { id?: string; rev?: number; hash?: string; createdAt?: string };
  publishedSnapshotId?: string;
  siteSlug?: string;
  cacheInfo?: { tags?: string[]; lastRevalidatedAt?: string };
}) {
  return (
    <Card className="border-neutral-200">
      <CardHeader className="py-3">
        <CardTitle className="text-sm">Single Source of Truth Map</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-3 items-stretch gap-2">
        <Node title="Draft" icon={<Save className="h-4 w-4" />}>
          <div className="text-xs text-muted-foreground">rev {draft.rev}</div>
          {draft.hash && <div className="text-[11px]">{shortHash(draft.hash)}</div>}
        </Node>

        <Arrow />

        <Node title="Snapshot" icon={<HardDriveDownload className="h-4 w-4" />} state={latestSnapshot?.id ? 'ok' : 'empty'}>
          {!latestSnapshot?.id && <div className="text-xs text-muted-foreground">none yet</div>}
          {latestSnapshot?.id && (
            <div className="text-xs">
              <div>rev {latestSnapshot.rev}</div>
              <div className="text-[11px] text-muted-foreground">{shortHash(latestSnapshot.hash)}</div>
            </div>
          )}
        </Node>

        <Arrow />

        <Node title="Publish" icon={<Rocket className="h-4 w-4" />} state={publishedSnapshotId ? 'ok' : 'warn'}>
          {publishedSnapshotId ? (
            <div className="text-xs">
              <div className="flex items-center gap-1">
                <LinkIcon className="h-3 w-3" /> snapshot
              </div>
              <div className="text-[11px] break-all">{publishedSnapshotId}</div>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">not published</div>
          )}
        </Node>

        <Separator className="col-span-3 my-1" />

        <Node title="Renderer" icon={<Eye className="h-4 w-4" />}>
          <div className="text-xs text-muted-foreground">reads snapshot only</div>
          {siteSlug && <div className="text-[11px]">/{siteSlug}</div>}
        </Node>
        <Arrow thin />
        <Node title="Cache" icon={<Box className="h-4 w-4" />}>
          <div className="text-xs">{cacheInfo?.tags?.length ?? 0} tags</div>
          {cacheInfo?.lastRevalidatedAt && (
            <div className="text-[11px] text-muted-foreground">{shortTime(cacheInfo.lastRevalidatedAt)}</div>
          )}
        </Node>
        <Arrow thin />
        <Node title="DB" icon={<Database className="h-4 w-4" />}>
          <div className="text-xs text-muted-foreground">templates • snapshots</div>
        </Node>
      </CardContent>
    </Card>
  );
}

function Node({
  title, icon, children, state,
}: { title: string; icon: React.ReactNode; children?: React.ReactNode; state?: 'ok' | 'warn' | 'empty' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}
      className={clsx('relative rounded-2xl border p-3 shadow-sm',
        state === 'ok' && 'border-emerald-300/60',
        state === 'warn' && 'border-amber-300/60',
        state === 'empty' && 'border-border')}
    >
      <div className="mb-1 flex items-center gap-2">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-md border bg-muted/40">{icon}</span>
        <div className="text-sm font-medium leading-none">{title}</div>
      </div>
      <div className="text-sm">{children}</div>
    </motion.div>
  );
}
function Arrow({ thin = false }: { thin?: boolean }) {
  return <div className="flex items-center justify-center"><div className={clsx('h-0.5 w-6 bg-border', thin && 'opacity-60')} /></div>;
}
