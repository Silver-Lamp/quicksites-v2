'use client';
import * as React from 'react';

export function CandidateDonateBlock({
  content,
}: {
  content?: { headline?: string; description?: string; url?: string; provider?: 'stripe' | 'actblue' | 'other' };
}) {
  const { headline = 'Donate to the Campaign', description = 'Every contribution helps us reach more voters.', url } = content ?? {};
  return (
    <section className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h3 className="text-xl font-semibold">{headline}</h3>
        <p className="mt-1 text-sm text-white/75">{description}</p>
        <div className="mt-4">
          <a
            href={url || '#'}
            aria-disabled={!url}
            className="inline-flex items-center rounded-lg bg-indigo-500/90 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-500 disabled:opacity-50"
            onClick={(e) => { if (!url) e.preventDefault(); }}
          >
            Donate
          </a>
        </div>
      </div>
    </section>
  );
}
