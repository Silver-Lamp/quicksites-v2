'use client';

// components/admin/templates/publish-state-pill.tsx
//
// The editor's top-bar answer to "is what's live what I'm looking at?" (owner, 2026-10-16).
// Reads /api/templates/<id>/publish-state after mount, again whenever an autosave lands and
// whenever a publish finishes, and shows one of three states:
//   · Not published            (grey)
//   · Live · up to date        (emerald)
//   · Unpublished changes      (amber — the draft differs from a served copy; the title says which)
// It never guesses from local state: the server compares the saved draft to the served snapshots.

import * as React from 'react';
import { CheckCircle2, CircleDashed, CloudUpload } from 'lucide-react';

type State = { status: 'not_published' | 'up_to_date' | 'changed'; changedWhere: Array<'platform' | 'domain'>; publishedAt: string | null; domainHost?: string | null };

export function PublishStatePill({ templateId, refreshKey, onPublishClick }: { templateId: string | null; refreshKey: string | number; onPublishClick?: () => void }) {
  const [state, setState] = React.useState<State | null>(null);
  React.useEffect(() => {
    if (!templateId) return;
    let alive = true;
    fetch(`/api/templates/${templateId}/publish-state`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => alive && j?.ok && setState(j))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [templateId, refreshKey]);

  if (!state) return null;
  if (state.status === 'not_published') {
    return (
      <span data-publish-state="not_published" className="inline-flex items-center gap-1 rounded-full border border-white/15 px-2 py-0.5 text-xs text-white/60" title="This site has not been published yet">
        <CircleDashed className="h-3.5 w-3.5" /> Not published
      </span>
    );
  }
  if (state.status === 'up_to_date') {
    return (
      <span data-publish-state="up_to_date" className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300" title={state.publishedAt ? `Live matches the latest save · published ${new Date(state.publishedAt).toLocaleString()}` : 'Live matches the latest save'}>
        <CheckCircle2 className="h-3.5 w-3.5" /> Live · up to date
      </span>
    );
  }
  const where = state.changedWhere.map((w) => (w === 'domain' ? state.domainHost || 'custom domain' : 'platform URL')).join(' and ');
  return (
    <button
      type="button"
      onClick={onPublishClick}
      data-publish-state="changed"
      className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-200 hover:bg-amber-500/25"
      title={`The live site (${where}) differs from your latest saved changes. Publish to update it.`}
    >
      <CloudUpload className="h-3.5 w-3.5" /> Unpublished changes
    </button>
  );
}
