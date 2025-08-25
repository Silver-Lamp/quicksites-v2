'use client';

import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui';
import { Clock, ChevronDown, Check } from 'lucide-react';
import { relativeTimeLabel } from '@/lib/editor/templateUtils';
import type { VersionRow } from '@/hooks/useTemplateVersions';

type Props = {
  labelTitle: string;
  versions: VersionRow[];                // sorted newest-first
  open: boolean;
  setOpen: (v: boolean) => void;
  onCreateSnapshot: () => Promise<void>;
  onRestore: (id: string) => Promise<void>;
  onPublish: (id?: string) => Promise<void>;  // undefined => publish latest
  publishedVersionId?: string | null;
};

export default function VersionsDropdown({
  labelTitle,
  versions,
  open,
  setOpen,
  onCreateSnapshot,
  onRestore,
  onPublish,
  publishedVersionId,
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  // Outside-click close with cleanup
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!open || !ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open, setOpen]);

  const latest = versions[0];
  const latestLabel = latest
    ? `${(latest.commit || '').trim() || 'Snapshot'} · ${relativeTimeLabel(latest.updated_at || latest.created_at || '')}`
    : 'No versions';

  return (
    <div className="relative" ref={ref}>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setOpen(!open)}
        title={versions.length ? 'Browse versions' : 'No versions yet'}
        className="inline-flex items-center gap-2"
      >
        <Clock className="w-4 h-4" />
        <span className="text-xs sm:text-sm max-w-[14ch] sm:max-w-none truncate">
          {versions.length ? latestLabel : 'No versions'}
        </span>
        <ChevronDown className="w-4 h-4 opacity-70" />
      </Button>

      {open && (
        <div className="absolute bottom-full mb-2 right-0 w-96 max-h-[28rem] overflow-auto rounded-md border border-gray-700 bg-gray-900 shadow-xl">
          <div className="p-2 text-xs text-gray-400 sticky top-0 bg-gray-900/95 backdrop-blur">
            {labelTitle}
          </div>

          <div className="px-3 py-2 space-y-2">
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  await onCreateSnapshot();
                  setOpen(false);
                }}
              >
                + Create snapshot
              </Button>
              <Button
                size="sm"
                variant="default"
                onClick={async () => {
                  await onPublish(); // publish latest
                  setOpen(false);
                }}
                disabled={!versions.length}
                title={versions.length ? 'Publish latest snapshot' : 'No versions yet'}
              >
                Publish latest
              </Button>
            </div>
          </div>

          {versions.length === 0 ? (
            <div className="px-3 pb-3 text-sm text-gray-300">
              No snapshots yet.
            </div>
          ) : (
            <div className="py-1">
              {versions.map((v) => {
                const when = relativeTimeLabel(v.updated_at || v.created_at || '');
                const label = `${(v.commit?.trim() || 'Snapshot')} · ${when}`;
                const isPublished = v.id === publishedVersionId;
                return (
                  <div
                    key={v.id}
                    className="w-full px-3 py-2 hover:bg-gray-800 text-sm flex items-center justify-between gap-2"
                  >
                    <button
                      onClick={async () => {
                        setOpen(false);
                        await onRestore(v.id);
                      }}
                      className="truncate text-left"
                      title="Restore into editor"
                    >
                      {label}
                    </button>
                    <div className="flex items-center gap-2">
                      {isPublished && (
                        <span className="inline-flex items-center text-emerald-400 text-xs" title="Currently published">
                          <Check className="w-3 h-3 mr-1" /> published
                        </span>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          await onPublish(v.id); // publish this specific version
                          setOpen(false);
                        }}
                        title="Publish this version"
                      >
                        Publish
                      </Button>
                    </div>
                  </div>
                );
              })}

              <div className="p-2 border-t border-gray-800 flex items-center justify-between text-xs">
                <span className="text-gray-400">{versions.length} total</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
