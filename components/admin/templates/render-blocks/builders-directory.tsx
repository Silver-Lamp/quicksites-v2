// components/admin/templates/render-blocks/builders-directory.tsx
'use client';
//
// A directory of EXTERNAL businesses for one trade in one region (first use: the
// <state>domebuilders.com pages). Every card shows only what the entry carries — name, place,
// what they do, how to reach them — and WHERE that came from. Nothing here may imply a
// business is licensed, insured, 24/7 or cheap; the schema has no such fields on purpose.
// Semantic tokens only (CLAUDE.md §7): the page may be light or dark.

import * as React from 'react';
import type { Block } from '@/types/blocks';
import SectionShell from '@/components/ui/section-shell';

type Entry = {
  name: string;
  city?: string;
  region?: string;
  phone?: string;
  website?: string;
  summary?: string;
  kinds?: string[];
  source_label?: string;
  source_url?: string;
  affiliate_url?: string;
};

type Props = {
  block: Block;
  content?: Block['content'];
  colorMode?: 'light' | 'dark';
  compact?: boolean;
  previewOnly?: boolean;
};

function pick(block: Block, override?: any) {
  const src = (override ?? (block as any)?.content ?? (block as any)?.props ?? {}) as any;
  const entries: Entry[] = Array.isArray(src.entries)
    ? src.entries.filter((e: any) => e && e.name)
    : [];
  return {
    title: String(src.title ?? ''),
    subtitle: String(src.subtitle ?? ''),
    tradeLabel: String(src.trade_label ?? 'builders'),
    regionLabel: String(src.region_label ?? ''),
    entries,
    ctaLabel: String(src.cta_label ?? ''),
    ctaLink: String(src.cta_link ?? ''),
    listingCtaLabel: String(src.listing_cta_label ?? ''),
    listingCtaLink: String(src.listing_cta_link ?? ''),
    affiliateDisclosure: String(src.affiliate_disclosure ?? ''),
    hasAffiliate: entries.some((e) => !!e.affiliate_url),
  };
}

function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export default function RenderBuildersDirectory({
  block,
  content,
  compact = false,
  previewOnly,
}: Props) {
  const d = React.useMemo(() => pick(block, content), [block, content]);
  const heading =
    d.title ||
    (d.regionLabel
      ? `${d.tradeLabel[0]?.toUpperCase() ?? ''}${d.tradeLabel.slice(1)} in ${d.regionLabel}`
      : d.tradeLabel);

  return (
    <SectionShell compact={compact} className={compact ? '' : 'mb-8'}>
      <div className="mx-auto w-full max-w-5xl">
        <h2 className={compact ? 'text-lg font-semibold' : 'text-2xl font-semibold tracking-tight'}>
          {heading}
        </h2>
        {d.subtitle ? <p className="mt-2 max-w-2xl text-muted-foreground">{d.subtitle}</p> : null}

        {d.ctaLink && d.ctaLabel ? (
          <div className="mt-5">
            <a
              href={d.ctaLink}
              className="inline-flex items-center rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
              target={d.ctaLink.startsWith('http') ? '_blank' : undefined}
              rel={d.ctaLink.startsWith('http') ? 'noopener noreferrer' : undefined}
            >
              {d.ctaLabel}
            </a>
          </div>
        ) : null}

        {d.entries.length === 0 ? (
          <p className="mt-6 rounded-lg border border-border bg-card p-4 text-sm text-card-foreground">
            {previewOnly
              ? `No ${d.tradeLabel} listed yet.`
              : `We have not verified any ${d.tradeLabel}${d.regionLabel ? ` in ${d.regionLabel}` : ''} yet.`}
          </p>
        ) : (
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {d.entries.map((e, i) => (
              <li
                key={`${e.name}-${i}`}
                className="flex flex-col rounded-xl border border-border bg-card p-4 text-card-foreground"
              >
                <div className="text-base font-semibold">{e.name}</div>
                {e.city || e.region ? (
                  <div className="mt-0.5 text-sm text-muted-foreground">
                    {[e.city, e.region].filter(Boolean).join(', ')}
                  </div>
                ) : null}
                {e.kinds && e.kinds.length ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {e.kinds.map((k) => (
                      <span
                        key={k}
                        className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                      >
                        {k}
                      </span>
                    ))}
                  </div>
                ) : null}
                {e.summary ? (
                  <p className="mt-2 flex-1 text-sm text-muted-foreground">{e.summary}</p>
                ) : (
                  <div className="flex-1" />
                )}
                <div className="mt-3 flex flex-wrap gap-3 text-sm">
                  {e.phone ? (
                    <a
                      href={`tel:${e.phone.replace(/[^\d+]/g, '')}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {e.phone}
                    </a>
                  ) : null}
                  {e.affiliate_url ? (
                    <a
                      href={e.affiliate_url}
                      target="_blank"
                      rel="noopener noreferrer sponsored"
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {hostOf(e.website || e.affiliate_url)}
                      <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                        (affiliate)
                      </span>
                    </a>
                  ) : e.website ? (
                    <a
                      href={e.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {hostOf(e.website)}
                    </a>
                  ) : null}
                </div>
                {e.source_label || e.source_url ? (
                  <div className="mt-2 text-[11px] text-muted-foreground">
                    Source:{' '}
                    {e.source_url ? (
                      <a
                        href={e.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline-offset-2 hover:underline"
                      >
                        {e.source_label || hostOf(e.source_url)}
                      </a>
                    ) : (
                      e.source_label
                    )}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {d.hasAffiliate && d.affiliateDisclosure ? (
          <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
            {d.affiliateDisclosure}
          </p>
        ) : null}

        {d.listingCtaLink && d.listingCtaLabel ? (
          <p className="mt-6 text-sm text-muted-foreground">
            <a href={d.listingCtaLink} className="font-medium underline-offset-4 hover:underline">
              {d.listingCtaLabel}
            </a>
          </p>
        ) : null}
      </div>
    </SectionShell>
  );
}
