// Every outreach touch, everywhere, newest first — plus who has not answered.
//
// ⚠️ "Waiting" IS NOT "IGNORED". The list below reports days since we last spoke and nothing
// about intent. A contractor who has not replied in nine days may be on a roof. The column is
// named for the fact, not the interpretation.
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { listAllTouches, awaitingReply } from '@/lib/outreach/touches';
import TouchLog from '@/components/admin/outreach/touch-log';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function OutreachLogPage() {
  const admin = await getAdminUser();
  if (!admin) return <div className="p-8 text-muted-foreground">Forbidden.</div>;

  const touches = await listAllTouches();
  const waiting = awaitingReply(touches);

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Outreach log</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        What was actually sent, and what came back — stored verbatim, because a timestamp cannot
        answer &ldquo;what did I say?&rdquo;
      </p>

      {waiting.length > 0 && (
        <section className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
          <h2 className="text-sm font-semibold text-foreground">No reply yet</h2>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {waiting.slice(0, 12).map((w) => (
              <li key={w.subjectKey}>
                <span className="text-foreground">{w.label}</span> — {w.daysWaiting} day
                {w.daysWaiting === 1 ? '' : 's'} since {w.lastOutbound.channel}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-6">
        <TouchLog subjectLabel={null} title="Everything" />
      </div>
    </div>
  );
}
