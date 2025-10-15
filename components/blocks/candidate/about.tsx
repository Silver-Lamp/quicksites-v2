import * as React from "react";
import type { CandidateAbout } from "@/lib/blocks/candidate/schemas";

export function CandidateAboutBlock({ content }: { content: CandidateAbout }) {
  return (
    <section className="mx-auto max-w-5xl px-4 py-16">
      <h2 className="text-2xl font-bold md:text-3xl">About</h2>
      <p className="mt-4 text-base leading-relaxed text-gray-700 dark:text-gray-200">{content.markdown}</p>
    </section>
  );
}
