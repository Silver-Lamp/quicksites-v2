// lib/creative/projects.ts
//
// The creative-review projects: one per client surface whose takes are reviewed on
// /review/<project>. Pure data, like lib/people/qsPeople.ts. Adding a client = one entry.
//
// `templateSlug` is the site whose `audio`/`video` block the set-live route swaps; `reviewers`
// are the people a signed link is minted for (the page shows an admin the links to send). A
// track's `blockTitle` is how the live block is found the FIRST time, before any version row
// mirrors it — after that the swap matches on the live version's URL.
export type ReviewProject = {
  key: string;
  title: string;
  templateSlug: string;
  reviewers: Array<{ key: string; name: string }>;
  tracks: Array<{ key: string; label: string; kind: 'audio' | 'video'; blockTitle?: string }>;
};

export const REVIEW_PROJECTS: ReviewProject[] = [
  {
    key: 'bhard',
    title: 'B Hard',
    templateSlug: 'bhard',
    reviewers: [
      { key: 'amy', name: 'Amy' },
      { key: 'daryle', name: 'Daryle' },
    ],
    tracks: [
      { key: 'get-it-done', label: 'Get It Done (jingle)', kind: 'audio', blockTitle: 'Get It Done' },
      { key: 'bhard-jingle', label: 'B Hard (jingle)', kind: 'audio', blockTitle: 'B Hard — the jingle' },
      { key: 'pool-spot', label: 'Pool (commercial)', kind: 'video' },
      { key: 'squatbot-spot', label: 'SquatBot (commercial)', kind: 'video' },
    ],
  },
];

export function reviewProject(key: string): ReviewProject | null {
  const k = String(key ?? '').trim().toLowerCase();
  return REVIEW_PROJECTS.find((p) => p.key === k) ?? null;
}
