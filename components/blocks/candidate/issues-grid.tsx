import * as React from "react";
import type { CandidateIssues } from "@/lib/blocks/candidate/schemas";

export function CandidateIssuesGridBlock({ content }: { content: CandidateIssues }) {
  return (
    <section className="mx-auto max-w-5xl px-4 py-16">
      <h2 className="text-2xl font-bold md:text-3xl text-center">Key Priorities</h2>
      <div className="mt-8 grid gap-6 md:grid-cols-3">
        {content.items.map((issue, i) => (
          <div key={i} className="rounded-2xl border bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <h3 className="text-lg font-semibold text-indigo-600 dark:text-indigo-400">{issue.title}</h3>
            <p className="mt-2 text-sm text-gray-700 dark:text-gray-200">{issue.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
