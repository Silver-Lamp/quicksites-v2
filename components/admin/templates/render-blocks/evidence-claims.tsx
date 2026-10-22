'use client';

// The `evidence_claims` block: graded health claims for one topic. The block stores only the topic
// and which claims to show; every grade is DERIVED here from lib/evidence records at render, so a
// page cannot carry a grade the evidence doesn't produce (lib/evidence/grade.ts). Empty or unknown
// topic → nothing in public, a hint in the editor (the two-sided rule, isEditorContext).
import * as React from 'react';
import { describeEvidence, gradeClaim, GRADE_LABEL, type EvidenceGrade } from '@/lib/evidence/grade';
import { evidenceTopic } from '@/lib/evidence/topics';
import { isEditorContext } from '@/lib/editor/isEditorContext';

type Content = { topic?: string; claim_ids?: string[]; title?: string; show_studies?: boolean };

function pickContent(block: any, override?: any): Content {
  return (override ?? block?.content ?? block?.props ?? {}) as Content;
}

// Alpha tints with the site's own text colour, so the badge reads on a light or dark site without
// leaning on `dark:` (CLAUDE.md §7; sectionShellColor.test.ts counts renderers that do).
const BADGE: Record<EvidenceGrade, string> = {
  established: 'bg-emerald-500/20 border-emerald-500/40',
  promising: 'bg-sky-500/20 border-sky-500/40',
  early: 'bg-amber-500/20 border-amber-500/40',
  lab_only: 'bg-violet-500/20 border-violet-500/40',
  tested_no_effect: 'bg-rose-500/20 border-rose-500/40',
  no_evidence: 'bg-zinc-500/20 border-zinc-500/40',
};

export default function EvidenceClaimsRender({ block, content, previewOnly }: { block: any; content?: any; previewOnly?: boolean }) {
  const c = pickContent(block, content);
  const topic = evidenceTopic(c.topic);
  if (!topic) {
    if (!isEditorContext(previewOnly)) return null;
    return (
      <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
        Evidence Grades: choose a topic (for example <code>mullein</code>). Grades are calculated from the study records, never typed.
      </div>
    );
  }
  const wanted = Array.isArray(c.claim_ids) && c.claim_ids.length ? new Set(c.claim_ids) : null;
  const claims = topic.claims.filter((x) => !wanted || wanted.has(x.id));
  const byId = new Map(topic.studies.map((s) => [s.id, s]));
  const showStudies = c.show_studies !== false;

  return (
    // Rows divided by hairlines rather than filled cards, a small uppercase label over the title —
    // the quieter layout of the Tried & Graded design pass (docs/longevity/TRIEDANDGRADED_DESIGN.md).
    <section className="mx-auto w-full max-w-3xl px-4 py-10 text-foreground" data-evidence-topic={topic.key}>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{topic.label} · evidence checked {topic.checked}</p>
      {c.title ? <h2 className="mb-1 text-2xl font-medium tracking-tight">{c.title}</h2> : null}
      <p className="mb-6 text-sm text-muted-foreground">Grades are calculated from the studies listed, by fixed rules.</p>
      <ul className="divide-y divide-border border-y border-border">
        {claims.map((cl) => {
          const g = gradeClaim(cl.evidence, topic.studies);
          return (
            <li key={cl.id} className="py-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-lg font-medium leading-snug">{cl.claim}</span>
                <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold text-foreground ${BADGE[g]}`} data-grade={g}>
                  {GRADE_LABEL[g]}
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{cl.note}</p>
              {showStudies && cl.evidence.length > 0 ? (
                <ul className="mt-2 space-y-1 text-sm">
                  {cl.evidence.map((e) => {
                    const s = byId.get(e.studyId);
                    if (!s) return null;
                    return (
                      <li key={e.studyId}>
                        <a href={s.url} className="underline underline-offset-2" target="_blank" rel="noopener noreferrer">
                          {describeEvidence(e, s)}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
