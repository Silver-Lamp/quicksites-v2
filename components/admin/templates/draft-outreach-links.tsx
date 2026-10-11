'use client';

// components/admin/templates/draft-outreach-links.tsx
//
// The outreach row under a listing-import draft on the templates list: preview, the Evolve
// page, the postcard (front/back), a copyable claim link, and what has happened so far — the
// same options the no-ordering page offers, so an operator browsing sites does not have to
// go find the prospect first. Data is `row.outreach`, shaped by lib/outreach/draftLinks.ts.
import * as React from 'react';
import type { DraftOutreachLinks } from '@/lib/outreach/draftLinks';

const pill = 'inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium';

export default function DraftOutreachLinksRow({ links, className }: { links: DraftOutreachLinks | null | undefined; className?: string }) {
  const [copied, setCopied] = React.useState(false);
  if (!links) return null;
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(links.claimUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt('Claim link', links.claimUrl);
    }
  };
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className ?? ''}`} onClick={stop}>
      <a href={links.previewUrl} target="_blank" rel="noopener noreferrer" onClick={stop} className={`${pill} border-zinc-700 bg-zinc-800/60 text-zinc-200 hover:bg-zinc-700/60`}>
        Preview ↗
      </a>
      {links.evolveUrl && (
        <a href={links.evolveUrl} target="_blank" rel="noopener noreferrer" onClick={stop} title="The 'your site stays, add ordering' pitch page" className={`${pill} border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20`}>
          Evolve page ↗
        </a>
      )}
      {links.cardFrontUrl && links.cardBackUrl && (
        <span className={`${pill} border-violet-500/40 bg-violet-500/10 text-violet-200`}>
          Postcard:
          <a href={links.cardFrontUrl} target="_blank" rel="noopener noreferrer" onClick={stop} className="underline hover:text-white">front</a>
          ·
          <a href={links.cardBackUrl} target="_blank" rel="noopener noreferrer" onClick={stop} className="underline hover:text-white">back</a>
        </span>
      )}
      <button type="button" onClick={copy} title="For the owner only — send it privately, never post it" className={`${pill} border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20`}>
        {copied ? 'Copied' : 'Copy claim link'}
      </button>
      {links.builtFromPost && <span className="text-[11px] text-zinc-500">built from their post</span>}
      {links.status && <span className="text-[11px] text-zinc-400">{links.status}</span>}
    </div>
  );
}
