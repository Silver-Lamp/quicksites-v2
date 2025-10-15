import * as React from "react";
import type { CandidateEvents } from "@/lib/blocks/candidate/schemas";

export function CandidateEventsBlock({ content }: { content: CandidateEvents }) {
  return (
    <section className="mx-auto max-w-5xl px-4 py-16 bg-gray-100 dark:bg-gray-900/40 rounded-3xl">
      <h2 className="text-2xl font-bold md:text-3xl text-center">Upcoming Events</h2>
      <div className="mt-8 space-y-4 text-sm text-gray-700 dark:text-gray-200">
        {content.items.map((ev, i) => (
          <div key={i} className="rounded-xl border bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-950">
            <div className="font-semibold">{ev.title}</div>
            <div>{new Date(ev.dateISO).toLocaleString()} • {ev.venue}</div>
            {ev.blurb && <p className="mt-1 text-xs text-gray-500">{ev.blurb}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}
