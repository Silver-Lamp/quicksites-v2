'use client';

import * as React from 'react';
import type { FeatureCode } from '@/lib/electinfo/features';
import UnlockCTA from './UnlockCTA';
import { Lock, Sparkles, CheckCircle2 } from 'lucide-react';

type Props = {
  feature: FeatureCode;
  enabled: boolean;
  label: string;
  children: React.ReactNode;
  siteId?: string;
  slug?: string;
  variant?: 'inline' | 'card';
  blurb?: string;
  benefits?: string[];
  /** Extra classes for the OUTER wrapper (append to the container) */
  className?: string;
  /** Centered container classes for width + side padding */
  containerClassName?: string;
  /** Max height (px) for blurred preview when variant='inline' */
  teaserMaxHeight?: number;

  /** NEW: Show “Text” button (default false) */
  allowText?: boolean;
  /** NEW: Show “Email” button (default false) */
  allowEmail?: boolean;
};

export default function GatedFeature({
  feature,
  enabled,
  label,
  children,
  siteId,
  slug,
  variant = 'card',
  blurb,
  benefits,
  className = '',
  containerClassName = 'mx-auto max-w-5xl px-4 sm:px-6 lg:px-8',
  teaserMaxHeight = 160,
  allowText = false,
  allowEmail = false,
}: Props) {
  if (enabled) return <>{children}</>;

  return (
    <div className={`${containerClassName} ${className}`}>
      {/* Compact, clamped preview inside the same container */}
      {variant === 'inline' && (
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
          <div
            className="opacity-40 blur-[1px] pointer-events-none select-none"
            style={{ maxHeight: teaserMaxHeight, overflow: 'hidden' }}
          >
            {children}
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-gray-950/80" />
        </div>
      )}

      {/* Lock card, also constrained by container */}
      <div className="mt-3 rounded-2xl p-[1px] bg-gradient-to-r from-indigo-500/35 via-sky-500/35 to-cyan-500/35 shadow-[0_0_0_1px_rgba(255,255,255,0.06)_inset,0_10px_30px_-10px_rgba(0,0,0,0.5)]">
        <div className="rounded-2xl bg-gray-900/60 border border-white/10 backdrop-blur-md px-4 py-3 sm:px-5 sm:py-4 flex items-start gap-4">
          <div className="relative">
            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-gray-800/80 border border-white/10 flex items-center justify-center">
              <Lock className="h-4 w-4 sm:h-5 sm:w-5 text-white/80" />
            </div>
            <span className="absolute -top-1 -right-1 inline-flex items-center gap-1 rounded-full px-1.5 py-[1px] text-[10px] font-medium bg-gradient-to-r from-indigo-500/80 to-cyan-500/80 text-white/95">
              Locked
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-semibold tracking-tight">{label}</h3>
              <Sparkles className="h-4 w-4 text-cyan-300/80" />
            </div>
            {blurb && <p className="mt-1 text-xs sm:text-sm text-white/70">{blurb}</p>}
            {benefits?.length ? (
              <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                {benefits.map((b, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs sm:text-sm text-white/75">
                    <CheckCircle2 className="h-4 w-4 text-cyan-300/80 shrink-0" />
                    <span className="truncate">{b}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <UnlockCTA
            feature={feature}
            siteId={siteId}
            slug={slug}
            allowText={allowText}
            allowEmail={allowEmail}
          />
        </div>
      </div>
    </div>
  );
}
