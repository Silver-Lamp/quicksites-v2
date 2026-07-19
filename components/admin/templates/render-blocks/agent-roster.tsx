'use client';

// components/admin/templates/render-blocks/agent-roster.tsx
//
// "Meet our agents" roster for an agency site. A grid of agent cards — headshot (with an
// initials fallback), name + title, bio, optional phone/email, and the strategic bit: a
// per-agent About That voice player, so each agent talks in their OWN voice. The voice slot
// is keyed per-card by embed_id (same primitive as listing_card); many embeds on one page is
// already proven fine. Voice renders only when the id is a valid uuid — otherwise the card is
// a clean headshot+bio, no broken player.

import * as React from 'react';
import type { Block } from '@/types/blocks';
import { AboutThatEmbed, isValidEmbedId } from './about-that';

type Props = {
  block?: Block;
  content?: Block['content'];
  previewOnly?: boolean;
};

type Agent = {
  name: string;
  title: string;
  photo_url: string;
  bio: string;
  phone: string;
  email: string;
  about_that_embed_id: string;
};

function str(v: any): string {
  return typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '';
}

function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (!parts.length) return '🙂';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

const COLS: Record<number, string> = {
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-2 lg:grid-cols-3',
  4: 'sm:grid-cols-2 lg:grid-cols-4',
};

export default function RenderAgentRoster({ block, content }: Props) {
  const c: any = content ?? block?.content ?? (block as any)?.props ?? {};
  const title = str(c.title) || 'Meet Our Agents';
  const subtitle = str(c.subtitle);
  const colsRaw = Number(c.columns);
  const cols = colsRaw >= 2 && colsRaw <= 4 ? colsRaw : 3;

  const agents: Agent[] = (Array.isArray(c.agents) ? c.agents : [])
    .map((a: any) => ({
      name: str(a?.name),
      title: str(a?.title),
      photo_url: str(a?.photo_url),
      bio: str(a?.bio),
      phone: str(a?.phone),
      email: str(a?.email),
      about_that_embed_id: str(a?.about_that_embed_id),
    }))
    .filter((a: Agent) => a.name || a.bio || a.photo_url);

  if (!agents.length) return null;

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-12">
      <div className="mb-8 text-center">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
        {subtitle && <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">{subtitle}</p>}
      </div>

      <div className={`grid grid-cols-1 gap-6 ${COLS[cols]}`}>
        {agents.map((a, i) => (
          <div
            key={`${a.name}-${i}`}
            className="flex flex-col rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm"
          >
            <div className="flex items-center gap-4">
              {a.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={a.photo_url}
                  alt={a.name || 'Agent'}
                  className="h-16 w-16 shrink-0 rounded-full object-cover"
                />
              ) : (
                <div
                  className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/15 text-lg font-semibold text-primary"
                  aria-hidden
                >
                  {initials(a.name)}
                </div>
              )}
              <div className="min-w-0">
                {a.name && <div className="truncate text-lg font-semibold leading-tight">{a.name}</div>}
                {a.title && (
                  <div className="truncate text-xs font-medium uppercase tracking-wide text-primary">{a.title}</div>
                )}
              </div>
            </div>

            {a.bio && <p className="mt-4 text-sm leading-relaxed text-foreground/90">{a.bio}</p>}

            {/* The moat: this agent, in their own voice. */}
            {isValidEmbedId(a.about_that_embed_id) && (
              <div className="mt-4">
                <div className="mb-1 text-xs font-medium text-muted-foreground">
                  🎙️ Hear from {a.name || 'this agent'}
                </div>
                <AboutThatEmbed embedId={a.about_that_embed_id} />
              </div>
            )}

            {(a.phone || a.email) && (
              <div className="mt-auto flex flex-wrap gap-3 pt-4 text-sm">
                {a.phone && (
                  <a href={`tel:${a.phone.replace(/[^0-9+]/g, '')}`} className="font-medium text-primary hover:underline">
                    📞 {a.phone}
                  </a>
                )}
                {a.email && (
                  <a href={`mailto:${a.email}`} className="font-medium text-primary hover:underline">
                    ✉️ Email
                  </a>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
