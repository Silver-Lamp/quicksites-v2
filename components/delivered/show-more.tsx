'use client';

// A server-rendered list, the first `initial` children shown, the rest behind one tap. The
// children are already in the HTML (crawlers and no-JS see all of them); this only decides what
// a visitor scrolls past before asking for more.
//
// ⚠️ PROPS MUST BE SERIALIZABLE. The first version took `label: (hidden) => string` — a function
// from a server component — and the whole delivered.menu apex rendered "Application error"
// (2026-10-14, seen only by screenshotting the live page after the merge chain said LIVE).
// A client component's props cross the server→client boundary as JSON; a string survives, a
// function does not.
import * as React from 'react';

export default function ShowMore({ initial, children, moreLabel }: { initial: number; children: React.ReactNode[]; /** Noun phrase after the count: "Show 42 {moreLabel}". */ moreLabel: string }) {
  const [open, setOpen] = React.useState(false);
  const all = React.Children.toArray(children);
  const shown = open ? all : all.slice(0, initial);
  const hidden = all.length - shown.length;
  return (
    <>
      {shown}
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="col-span-full justify-self-start rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-card-foreground transition hover:border-amber-500/40"
        >
          Show {hidden} {moreLabel}
        </button>
      )}
    </>
  );
}
