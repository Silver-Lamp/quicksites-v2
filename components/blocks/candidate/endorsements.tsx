import * as React from "react";
import type { CandidateEndorsements } from "@/lib/blocks/candidate/schemas";

export function CandidateEndorsementsBlock({ content }: { content: CandidateEndorsements }) {
  return (
    <section className="mx-auto max-w-5xl px-4 py-16">
      <h2 className="text-2xl font-bold md:text-3xl text-center">Meet the Endorsements</h2>
      <div className="mt-8 grid gap-6 md:grid-cols-3">
        {content.items.map((endorsement, i) => (
          <div key={i} className="rounded-2xl border bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <p className="text-sm italic text-gray-700 dark:text-gray-200">“{endorsement.quote}”</p>
            <div className="mt-3 text-sm font-semibold text-indigo-600 dark:text-indigo-400">— {endorsement.org}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
