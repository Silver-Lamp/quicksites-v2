// components/admin/templates/rebuild-pitch-badge.tsx
//
// Surfaces "this site was created from an existing site URL" on the templates list
// (grid + table), plus the next step in the pitch pipeline. Mirrors CampaignBadge's
// compact-pill style. The provenance pill links to the original site; the "Next" pill
// links into the editor so the operator can act, and its tooltip shows the full
// pipeline so the ordering is visible at a glance.

'use client';

import Link from 'next/link';
import { RefreshCw, ArrowRight } from 'lucide-react';
import { rebuildPitch } from '@/lib/rebuild/pitchPipeline';

export function RebuildPitchBadge({
  row,
  slug,
  className,
}: {
  row: any;
  /** Editor slug for the "Next" pill; falls back to a static pill when absent. */
  slug?: string | null;
  className?: string;
}) {
  const pitch = rebuildPitch(row);
  if (!pitch.isRebuild || !pitch.provenance) return null;

  const { sourceUrl, sourceHost } = pitch.provenance;
  const next = pitch.nextStep;
  const editHref = slug ? `/admin/templates/${slug}` : null;

  // Full ordered pipeline as tooltip text (✓ done / n. pending) so the badge conveys
  // the whole sequence, not just the current step.
  const pipeline = pitch.steps.map((s, i) => `${s.done ? '✓' : `${i + 1}.`} ${s.label}`).join('\n');
  const nextTitle = next ? `${next.hint}\n\nPitch pipeline:\n${pipeline}` : pipeline;

  const pillBase =
    'inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium';

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className ?? ''}`}>
      {sourceUrl ? (
        <a
          href={sourceUrl.startsWith('http') ? sourceUrl : `https://${sourceUrl}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          title={`Rebuilt from ${sourceUrl}`}
          className={`${pillBase} border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20`}
        >
          <RefreshCw className="h-3 w-3 shrink-0" />
          <span className="truncate">From {sourceHost || 'a site'}</span>
        </a>
      ) : (
        <span
          title="Created from an existing site URL"
          className={`${pillBase} border-amber-500/40 bg-amber-500/10 text-amber-200`}
        >
          <RefreshCw className="h-3 w-3 shrink-0" />
          <span className="truncate">Rebuilt from URL</span>
        </span>
      )}

      {next &&
        (editHref ? (
          <Link
            href={editHref}
            onClick={(e) => e.stopPropagation()}
            title={nextTitle}
            className={`${pillBase} border-sky-500/40 bg-sky-500/10 text-sky-200 hover:bg-sky-500/20`}
          >
            <span className="truncate">Next: {next.label}</span>
            <ArrowRight className="h-3 w-3 shrink-0" />
          </Link>
        ) : (
          <span
            title={nextTitle}
            className={`${pillBase} border-sky-500/40 bg-sky-500/10 text-sky-200`}
          >
            <span className="truncate">Next: {next.label}</span>
          </span>
        ))}
    </div>
  );
}
