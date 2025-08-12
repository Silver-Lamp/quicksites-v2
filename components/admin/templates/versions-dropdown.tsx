'use client';

import { useRef } from 'react';
import { Button } from '@/components/ui';
import { Clock, ChevronDown } from 'lucide-react';
import { relativeTimeLabel } from '@/lib/editor/templateUtils';
import type { VersionRow } from '@/hooks/useTemplateVersions';

type Props = {
  labelTitle: string;
  versions: VersionRow[];
  open: boolean;
  setOpen: (v: boolean) => void;
  onCreateSnapshot: () => Promise<void>;
  onRestore: (id: string) => Promise<void>;
};

export default function VersionsDropdown({
  labelTitle,
  versions,
  open,
  setOpen,
  onCreateSnapshot,
  onRestore,
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  // outside click closer
  // (parent should control open; this is here to keep it easy to reuse)
  if (typeof window !== 'undefined') {
    // useCapture-off simple handler
    const handler = (e: MouseEvent) => {
      if (!open) return;
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', handler);
    // cleanup is handled by React unmount re-run; keep lightweight
  }

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
        <div className="absolute bottom-full mb-2 right-0 w-80 max-h-96 overflow-auto rounded-md border border-gray-700 bg-gray-900 shadow-xl">
          <div className="p-2 text-xs text-gray-400 sticky top-0 bg-gray-900/95 backdrop-blur">
            {labelTitle}
          </div>

          {versions.length === 0 ? (
            <div className="px-3 py-3 text-sm text-gray-300">
              No snapshots yet.
              <div className="mt-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    await onCreateSnapshot();
                    setOpen(false);
                  }}
                >
                  Create snapshot
                </Button>
              </div>
            </div>
          ) : (
            <div className="py-1">
              <div className="px-2 pb-2 flex justify-end">
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
              </div>

              {versions.map((v) => {
                const label = `${(v.commit?.trim() || 'Snapshot')} · ${relativeTimeLabel(
                  v.updated_at || v.created_at || ''
                )}`;
                return (
                  <button
                    key={v.id}
                    onClick={async () => {
                      setOpen(false);
                      await onRestore(v.id);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-gray-800 text-sm"
                  >
                    {label}
                  </button>
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
