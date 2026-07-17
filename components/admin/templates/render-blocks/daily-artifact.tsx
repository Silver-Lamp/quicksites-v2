'use client';

// components/admin/templates/render-blocks/daily-artifact.tsx
//
// Daily Artifact — a person's OWN HiveJournal daily comic on their about-me site
// (crosstalk/contracts/daily-artifact-embed.md, LIVE). Consent is enforced ENTIRELY
// on HJ's side (opt-in off by default, opaque per-user token, instant 404-revocation,
// comic stars "Buzz" never real names). This block just resolves the token → GETs the
// embed endpoint → renders the image; a 404 means "not opted in / no comic" and we
// render NOTHING (the gate working, not an error). Backend host, not www.

import * as React from 'react';
import type { Block } from '@/types/blocks';

const EMBED_BASE = 'https://hivejournalbackend-production.up.railway.app/api/daily-comic/embed';

type Props = { block?: Block; content?: Block['content']; previewOnly?: boolean };
type Artifact = { image_url: string; caption: string | null; alt_text: string | null; date: string | null; author?: { name?: string | null } };

/** Accept a bare token OR a full embed URL pasted from the HJ dashboard. */
function resolveToken(embed: string): string {
  const s = (embed || '').trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) {
    const seg = s.split('?')[0].replace(/\/+$/, '').split('/').pop() || '';
    return seg;
  }
  return s;
}

export default function RenderDailyArtifact({ block, content, previewOnly }: Props) {
  const c: any = content ?? block?.content ?? {};
  const token = resolveToken(typeof c.embed === 'string' ? c.embed : '');
  const showCaption: boolean = c.show_caption !== false;

  const [art, setArt] = React.useState<Artifact | null>(null);
  const [dead, setDead] = React.useState(false); // 404/error → render nothing

  React.useEffect(() => {
    if (!token) return;
    let active = true;
    fetch(`${EMBED_BASE}/${encodeURIComponent(token)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!active) return;
        if (j && typeof j.image_url === 'string' && j.image_url) {
          setArt({ image_url: j.image_url, caption: j.caption ?? null, alt_text: j.alt_text ?? null, date: j.date ?? null, author: j.author });
        } else {
          setDead(true);
        }
      })
      .catch(() => active && setDead(true));
    return () => { active = false; };
  }, [token]);

  if (!token) {
    const inIframe = typeof window !== 'undefined' && window.parent !== window;
    if (!previewOnly && !inIframe) return null;
    return (
      <section className="mx-auto w-full max-w-md px-4 py-4">
        <div className="rounded-xl border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          🐝 <b>Daily Comic</b> — paste your embed link from HiveJournal (enable off-site embedding in your comics dashboard first).
        </div>
      </section>
    );
  }
  if (dead || !art) return null; // consent gate / no comic → render nothing

  return (
    <section className="mx-auto w-full max-w-md px-4 py-6 text-center">
      <figure>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={art.image_url} alt={art.alt_text || 'Comic of the day'} className="mx-auto w-full rounded-2xl border border-border shadow-sm" loading="lazy" />
        {showCaption && (art.caption || art.author?.name) && (
          <figcaption className="mt-2 text-xs text-muted-foreground">
            {art.caption}
            {art.author?.name ? `${art.caption ? ' · ' : ''}${art.author.name}` : ''}
          </figcaption>
        )}
      </figure>
    </section>
  );
}
