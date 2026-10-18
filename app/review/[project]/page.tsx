// app/review/[project]/page.tsx
//
// The creative-review page: every take of a client's jingles and spots, newest first, with a
// player, the transcript, thumbs up/down, and a comment thread where reviewers (on a signed link
// that names them) leave notes and the owner (admin session) replies. Unlisted, noindex.
//
// Identity: an admin session is the owner; otherwise `?as=<token>` must verify for THIS project.
// A visitor with neither sees nothing but a sentence — the takes are a client's unreleased work.
import type { Metadata } from 'next';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { reviewProject } from '@/lib/creative/projects';
import { mintReviewToken, verifyReviewToken, OWNER_REVIEWER } from '@/lib/creative/reviewToken';
import { listVersions, listFeedback, threadFeedback } from '@/lib/creative/versions';
import { ReviewClient } from './review-client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function generateMetadata({ params }: { params: Promise<{ project: string }> }): Promise<Metadata> {
  const { project } = await params;
  const p = reviewProject(project);
  return { title: p ? `${p.title} — takes for review` : 'Review', robots: { index: false, follow: false } };
}

export default async function ReviewPage({ params, searchParams }: { params: Promise<{ project: string }>; searchParams: Promise<{ as?: string }> }) {
  const { project: key } = await params;
  const { as } = await searchParams;
  const project = reviewProject(key);
  if (!project) {
    return <main className="mx-auto max-w-2xl px-4 py-16 text-foreground">No such project.</main>;
  }
  const admin = await getAdminUser().catch(() => null);
  const viewer = admin ? OWNER_REVIEWER : verifyReviewToken(as ?? null, project.key);
  if (!viewer) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-foreground">
        <h1 className="text-xl font-semibold">This page needs a review link.</h1>
        <p className="mt-2 text-muted-foreground">The link you were sent names you as the reviewer; this one is missing or has expired. Ask Sandon for a fresh one.</p>
      </main>
    );
  }
  const versions = await listVersions(project.key);
  const feedback = await listFeedback(versions.map((v) => v.id));
  const threads = versions.map((v) => threadFeedback(v, feedback));
  // The owner sees the links to send — minted here, never typed.
  const links = admin
    ? project.reviewers.map((r) => ({ name: r.name, href: `/review/${project.key}?as=${mintReviewToken(project.key, r)}` }))
    : [];
  return (
    <ReviewClient
      project={{ key: project.key, title: project.title, tracks: project.tracks }}
      viewer={viewer}
      isOwner={!!admin}
      token={admin ? null : (as ?? null)}
      initialThreads={threads}
      reviewerLinks={links}
    />
  );
}
