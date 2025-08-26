'use client';

import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui';
import { Clock, ChevronDown, Check, ExternalLink } from 'lucide-react';
import { relativeTimeLabel } from '@/lib/editor/templateUtils';
import type { VersionRow } from '@/hooks/useTemplateVersions';

type Props = {
  labelTitle: string;
  versions: VersionRow[];                // newest-first
  open: boolean;
  setOpen: (v: boolean) => void;
  onCreateSnapshot: () => Promise<void>;
  onRestore: (id: string) => Promise<void>;
  onPublish: (id?: string) => Promise<void>;  // undefined => publish latest
  publishedVersionId?: string | null;
  baseSlug?: string;
  domain?: string | null;
  defaultSubdomain?: string | null;
  onOpenPageSettings?: () => void;
};

const BASE_DOMAIN = process.env.NEXT_PUBLIC_BASE_DOMAIN || 'quicksites.ai';

function deriveBaseSlug(slug?: string | null) {
  if (!slug) return '';
  return slug.replace(/(-[a-z0-9]{2,12})+$/i, '');
}

function buildPreviewUrl(
  v: VersionRow,
  opts: { baseSlug?: string; domain?: string | null; defaultSubdomain?: string | null }
) {
  const { baseSlug, domain, defaultSubdomain } = opts;
  const loc = typeof window !== 'undefined' ? window.location : ({} as Location);
  const isLocal = (loc?.hostname || '').includes('localhost');
  const proto = loc?.protocol || 'https:';

  const canonical = baseSlug || deriveBaseSlug(v.slug);
  let host: string;
  if (isLocal) host = `${canonical}.localhost:3000`;
  else if (domain) host = domain;
  else if (defaultSubdomain) host = defaultSubdomain;
  else host = `${canonical}.${BASE_DOMAIN}`;

  const qs = new URLSearchParams({ preview_version_id: v.id }).toString();
  return `${proto}//${host}/?${qs}`;
}

function buildLiveUrl(
  opts: { baseSlug?: string; domain?: string | null; defaultSubdomain?: string | null }
) {
  const { baseSlug, domain, defaultSubdomain } = opts;
  const loc = typeof window !== 'undefined' ? window.location : ({} as Location);
  const isLocal = (loc?.hostname || '').includes('localhost');
  const proto = loc?.protocol || 'https:';
  const canonical = baseSlug || '';
  let host: string;
  if (isLocal) host = `${canonical}.localhost:3000`;
  else if (domain) host = domain;
  else if (defaultSubdomain) host = defaultSubdomain;
  else host = `${canonical}.${BASE_DOMAIN}`;
  return `${proto}//${host}/`;
}

export default function VersionsDropdown({
  labelTitle,
  versions,
  open,
  setOpen,
  onCreateSnapshot,
  onRestore,
  onPublish,
  publishedVersionId,
  baseSlug,
  domain,
  defaultSubdomain,
  onOpenPageSettings,
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  // Close on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!open || !ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open, setOpen]);

  // Auto-scroll the deployed row into view when opening
  useEffect(() => {
    if (!open) return;
    // wait one frame so rows exist
    const id = requestAnimationFrame(() => {
      const el = document.querySelector('[data-published="true"]') as HTMLElement | null;
      el?.scrollIntoView({ block: 'center' });
    });
    return () => cancelAnimationFrame(id);
  }, [open]);

  const latest = versions[0];
  const latestLabel = latest
    ? `${(latest.commit || '').trim() || 'Snapshot'} · ${relativeTimeLabel(latest.updated_at || latest.created_at || '')}`
    : 'No versions';

  const publishedRow = publishedVersionId ? versions.find(v => v.id === publishedVersionId) ?? null : null;
  const publishedLabel = publishedRow
    ? `${(publishedRow.commit?.trim() || 'Snapshot')} · ${relativeTimeLabel(publishedRow.updated_at || publishedRow.created_at || '')}`
    : null;
  const triggerLabel = publishedRow ? `Live: ${publishedLabel}` : latestLabel;
  const latestIsPublished = !!(publishedVersionId && latest && latest.id === publishedVersionId);

  return (
    <div className="relative" ref={ref}>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setOpen(!open)}
        title={versions.length ? 'Browse versions' : 'No versions yet'}
        className="inline-flex items-center gap-2"
      >
        {publishedRow ? (
          <>
            <span className="w-2 h-2 rounded-full bg-emerald-400" aria-hidden="true" />
            <span className="text-xs sm:text-sm max-w-[18ch] sm:max-w-none truncate text-emerald-400">
              {triggerLabel}
            </span>
          </>
        ) : (
          <>
            <Clock className="w-4 h-4" />
            <span className="text-xs sm:text-sm max-w-[14ch] sm:max-w-none truncate">
              {versions.length ? latestLabel : 'No versions'}
            </span>
          </>
        )}
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
                variant={latestIsPublished ? 'secondary' : 'default'}
                onClick={async () => {
                  await onPublish(); // publish latest
                  setOpen(false);
                }}
                disabled={!versions.length || latestIsPublished}
                title={
                  !versions.length
                    ? 'No versions yet'
                    : latestIsPublished
                    ? 'Latest is already live'
                    : 'Publish latest snapshot'
                }
              >
                {latestIsPublished ? 'Live' : 'Publish latest'}
              </Button>
            </div>
          </div>

          {versions.length === 0 ? (
            <div className="px-3 pb-3 text-sm text-gray-300">No snapshots yet.</div>
          ) : (
            <div className="py-1">
              {versions.map((v) => {
                const when = relativeTimeLabel(v.updated_at || v.created_at || '');
                const label = `${(v.commit?.trim() || 'Snapshot')} · ${when}`;
                const isPublished = v.id === publishedVersionId;

                return (
                  <div
                    key={v.id}
                    data-published={isPublished ? 'true' : undefined}
                    role="menuitemradio"
                    aria-checked={isPublished}
                    className={[
                      'relative w-full px-3 py-2 text-sm flex items-center justify-between gap-2 hover:bg-gray-800 rounded',
                      isPublished ? 'bg-emerald-950/30 ring-1 ring-emerald-500/30' : '',
                    ].join(' ')}
                  >
                    {isPublished && (
                      <span
                        aria-hidden="true"
                        className="absolute inset-y-0 left-0 w-1 bg-emerald-400 rounded-l"
                      />
                    )}
                    <button
                      onClick={async () => { setOpen(false); await onRestore(v.id); }}
                      className="truncate text-left"
                      title="Restore into editor"
                    >
                      {label}
                    </button>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm" variant="secondary"
                        onClick={(e) => {
                          e.preventDefault(); e.stopPropagation();
                          const url = isPublished
                            ? buildLiveUrl({ baseSlug, domain, defaultSubdomain })
                            : buildPreviewUrl(v, { baseSlug, domain, defaultSubdomain });
                          window.open(url, '_blank', 'noopener,noreferrer');
                          setOpen(false);
                        }}
                        title={isPublished ? 'Open live site' : 'Open this snapshot in a new tab'}
                      >
                        <ExternalLink className="w-3.5 h-3.5 mr-1" />
                        {isPublished ? 'Open live' : 'Preview'}
                      </Button>

                      {isPublished ? (
                        <span
                          className="inline-flex items-center px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-400 text-xs font-medium"
                          title="Currently deployed"
                        >
                          <Check className="w-3 h-3 mr-1" /> Live
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => { await onPublish(v.id); setOpen(false); }}
                          title="Publish this version"
                        >
                          Publish
                        </Button>
                      )}
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
