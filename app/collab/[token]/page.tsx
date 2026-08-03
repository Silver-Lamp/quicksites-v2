// app/collab/[token]/page.tsx
//
// The client's collaboration page: the layouts built for them, the conversation, and the choice.
//
// ⚠️ SERVER-RENDERED, WITH THE THREAD IN THE HTML. This is the page a client opens from an email
// on a phone on a train. It should not be a spinner while JavaScript decides whether they are
// allowed to see their own project — the token is in the URL, so the answer is known before the
// first byte.
//
// ⚠️ noindex. A private conversation about someone's business, reachable by anyone holding the
// link, must never end up in a search index.
import type { Metadata } from 'next';
import { verifyCollabToken } from '@/lib/collab/collabToken';
import { getCollab, listMessages, templatesByIds } from '@/lib/collab/collabs';
import { getCollabPreviews } from '@/lib/collab/previews';
import { resolveOptions } from '@/lib/collab/versions';
import { listClientFeedback } from '@/lib/collab/feedback';
import CollabClient from './collab-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Your site options',
  robots: { index: false, follow: false },
};

export default async function CollabPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const verified = verifyCollabToken(token);

  if (!verified) {
    // Deliberately vague and deliberately not a 404 page about a missing resource: whether a
    // thread exists is not something an unauthenticated holder of a bad link should learn.
    return (
      <main className="mx-auto max-w-lg px-6 py-24 text-center">
        <h1 className="text-2xl font-semibold text-foreground">This link isn’t working</h1>
        <p className="mt-3 text-muted-foreground">
          It may have expired, or been replaced by a newer one. Ask whoever sent it for a fresh
          link and it’ll pick up exactly where you left off.
        </p>
      </main>
    );
  }

  const collab = await getCollab(verified.collabId);
  if (!collab) {
    return (
      <main className="mx-auto max-w-lg px-6 py-24 text-center">
        <h1 className="text-2xl font-semibold text-foreground">This link isn’t working</h1>
        <p className="mt-3 text-muted-foreground">Ask whoever sent it for a fresh one.</p>
      </main>
    );
  }

  // Options carry their version history; feedback is only what an operator has promoted — the
  // filter lives inside listClientFeedback, not here (see lib/collab/feedback.ts).
  const [messages, options, feedback] = await Promise.all([
    listMessages(collab.id),
    resolveOptions(collab),
    listClientFeedback(collab.id),
  ]);

  // ⚠️ Resolve EVERY version's template, not just each option's latest. A v1 card rendering with
  // no name and no preview next to a v2 that has both reads as "the old one is broken", which is
  // the opposite of what a version switcher is for.
  const templatesById = await templatesByIds(
    options.flatMap((o) => o.versions.map((v) => v.templateId)),
  );
  const previews = await getCollabPreviews(
    Object.values(templatesById).map((t) => t.slug).filter(Boolean),
  );

  return (
    <CollabClient
      token={token}
      previews={previews}
      options={options}
      templatesById={templatesById}
      feedback={feedback}
      collab={{
        id: collab.id,
        title: collab.title,
        clientName: collab.client_name,
        status: collab.status,
        decidedTemplateId: collab.decided_template_id,
      }}
      initialMessages={messages}
    />
  );
}
