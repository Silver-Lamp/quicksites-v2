'use client';

// A server-rendered list, the first `initial` children shown, the rest behind one tap. The
// children are already in the HTML (crawlers and no-JS see all of them); this only decides what
// a visitor scrolls past before asking for more.
import * as React from 'react';

export default function ShowMore({ initial, children, label }: { initial: number; children: React.ReactNode[]; label: (hidden: number) => string }) {
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
          {label(hidden)}
        </button>
      )}
    </>
  );
}
