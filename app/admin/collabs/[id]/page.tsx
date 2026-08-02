// app/admin/collabs/[id]/page.tsx
//
// The operator's view of one client thread: the same conversation the client sees, plus the
// things only an operator should have — the shareable link, and the ability to ask a question
// rather than only reply.
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { getCollab, listMessages, listCollabTemplates } from '@/lib/collab/collabs';
import { mintCollabToken } from '@/lib/collab/collabToken';
import OperatorThread from './operator-thread';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function CollabDetail({ params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser();
  if (!admin) return <div className="p-8 text-muted-foreground">Forbidden.</div>;

  const { id } = await params;
  const collab = await getCollab(id);
  if (!collab) return <div className="p-8 text-muted-foreground">No such collaboration.</div>;

  const [messages, templates] = await Promise.all([listMessages(id), listCollabTemplates(collab)]);

  // Minted server-side, in the same process that will verify it — which is the whole lesson
  // from the secret-mismatch bug: an out-of-process mint resolved a different fallback link
  // and produced a link that worked nowhere and explained itself nowhere.
  let clientLink: string | null = null;
  try {
    clientLink = `/collab/${mintCollabToken(collab.id)}`;
  } catch {
    clientLink = null; // no signing secret configured — surfaced in the UI, not swallowed
  }

  return (
    <OperatorThread
      collab={{
        id: collab.id,
        title: collab.title,
        clientName: collab.client_name,
        status: collab.status,
        decidedTemplateId: collab.decided_template_id,
      }}
      templates={templates as any[]}
      initialMessages={messages}
      clientLink={clientLink}
      operatorName={admin.email ?? 'QuickSites'}
    />
  );
}
