'use client';
import * as React from 'react';

export function CandidateVolunteerBlock({
  content,
}: {
  content?: { headline?: string; blurb?: string };
}) {
  const { headline = 'Volunteer', blurb = 'Join the team to canvass, phone bank, or host a yard sign.' } = content ?? {};
  return (
    <section className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h3 className="text-xl font-semibold">{headline}</h3>
        <p className="mt-1 text-sm text-white/75">{blurb}</p>
        <form className="mt-4 grid gap-3 sm:grid-cols-2">
          <input className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none" placeholder="Full name" />
          <input className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none" placeholder="Email" type="email" />
          <input className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none sm:col-span-2" placeholder="Phone (optional)" />
          <button type="button" className="justify-self-start rounded-lg bg-indigo-500/90 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-500">
            I want to help
          </button>
        </form>
      </div>
    </section>
  );
}
