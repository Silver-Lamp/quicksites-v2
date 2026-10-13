'use client';

// components/admin/templates/render-blocks/perfect-loops-player.tsx
//
// HiveJournal's Perfect Loops player for one artist (crosstalk/contracts/artist-profile.md,
// AGREED 2026-10-13). The embed is per ARTIST — it plays all their published loops and
// carries HJ's own disclosure line — and this block adds a visible "HiveJournal" label beside
// it, because a third-party player on a customer's site must say whose it is (audio-honesty
// standard: attributed, user-initiated; `loading="lazy"`, no autoplay).
//
// ⚠️ ONLY HIVEJOURNAL HOSTS MAY BE FRAMED. `embed_url` is an iframe src on a customer's site;
// anything but HJ's own origin is refused at render time (and at the inbound endpoint). The
// fan link is the one URL every "play" button uses — it carries the artist's affiliate ref
// server-side, so this block never appends `?ref=`.
//
// ⚠️ EMPTY RENDERS NOTHING IN PUBLIC AND A PROMPT IN THE EDITOR (the gallery / reviews rule).

import * as React from 'react';
import type { Block } from '@/types/blocks';
import { isEditorContext } from '@/lib/editor/isEditorContext';

type Link = { platform?: string; url?: string };
type Props = { block?: Block; content?: Block['content']; previewOnly?: boolean };

const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** Hosts whose pages may be framed here. Exact hosts, no suffix match. */
export const PERFECT_LOOPS_EMBED_HOSTS = new Set(['www.hivejournal.com', 'hivejournal.com']);
export const PERFECT_LOOPS_FAN_LINK_HOSTS = new Set(['perfectloops.fm', 'www.perfectloops.fm', 'www.hivejournal.com', 'hivejournal.com']);

export function isAllowedEmbedUrl(u: string): boolean {
  try {
    const url = new URL(u);
    return url.protocol === 'https:' && PERFECT_LOOPS_EMBED_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

export function isAllowedFanLink(u: string): boolean {
  try {
    const url = new URL(u);
    return url.protocol === 'https:' && PERFECT_LOOPS_FAN_LINK_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

/** `?via=site` is accepted and recommended by HJ; nothing else is appended. */
export function fanLinkWithVia(u: string): string {
  try {
    const url = new URL(u);
    if (!url.searchParams.has('via')) url.searchParams.set('via', 'site');
    return url.toString();
  } catch {
    return u;
  }
}

const PLATFORM_LABEL: Record<string, string> = {
  bandcamp: 'Bandcamp',
  spotify: 'Spotify',
  apple_music: 'Apple Music',
  instagram: 'Instagram',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  soundcloud: 'SoundCloud',
  website: 'Website',
};

export default function RenderPerfectLoopsPlayer({ block, content, previewOnly }: Props) {
  const c: any = content ?? block?.content ?? {};
  const title = s(c.title) || 'Listen';
  const artist = s(c.artist_name);
  const embed = s(c.embed_url);
  const fan = s(c.fan_link_url);
  const links: Link[] = (Array.isArray(c.links) ? c.links : []).filter((l: Link) => /^https:\/\//.test(s(l.url)));

  const canEmbed = isAllowedEmbedUrl(embed);
  if (!canEmbed) {
    if (!isEditorContext(previewOnly)) return null;
    return (
      <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
        <div className="text-base">🔁</div>
        Perfect Loops player — paste the artist&apos;s HiveJournal embed URL in this block&apos;s panel
        {embed ? ' (only a hivejournal.com embed can be shown here)' : ''}. Nothing shows on your live site until you do.
      </div>
    );
  }

  return (
    <section id="listen" className="py-10">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">{title}</h2>
        <span className="text-xs text-muted-foreground">Player by HiveJournal · Perfect Loops</span>
      </div>
      <iframe
        src={embed}
        title={artist ? `${artist} on Perfect Loops` : 'Perfect Loops player'}
        width="100%"
        height="300"
        style={{ border: 0, borderRadius: 16 }}
        allow="autoplay"
        loading="lazy"
      />
      {(isAllowedFanLink(fan) || links.length > 0) && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {isAllowedFanLink(fan) && (
            <a
              href={fanLinkWithVia(fan)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Listen on Perfect Loops
            </a>
          )}
          {links.map((l, i) => (
            <a
              key={`${s(l.url)}-${i}`}
              href={s(l.url)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-full border border-border px-3 py-1.5 text-sm text-foreground"
            >
              {PLATFORM_LABEL[s(l.platform).toLowerCase()] || s(l.platform) || 'Link'}
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
