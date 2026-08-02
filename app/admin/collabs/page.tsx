// app/admin/collabs/page.tsx
//
// The operator's side of Custom Sites: every client thread, ordered by who is waiting.
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { listCollabs } from '@/lib/collab/listCollabs';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function CollabsPage() {
  const admin = await getAdminUser();
  if (!admin) return <div className="p-8 text-muted-foreground">Forbidden.</div>;

  const collabs = await listCollabs();

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Client collaborations</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Ordered by last activity, so whoever is waiting on you is at the top.
      </p>

      {collabs.length === 0 && (
        <p className="mt-8 rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          No client threads yet.
        </p>
      )}

      <ul className="mt-6 space-y-3">
        {collabs.map((c) => {
          // "The client spoke last" is the signal that matters — it means the ball is ours.
          const yourTurn = c.last_message_role === 'client';
          return (
            <li key={c.id}>
              <Link
                href={`/admin/collabs/${c.id}`}
                className={`block rounded-2xl border p-4 transition hover:border-sky-500/40 ${
                  yourTurn ? 'border-sky-500/40 bg-sky-500/5' : 'border-border bg-card'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-semibold text-card-foreground">{c.title}</h2>
                  <div className="flex items-center gap-2 text-xs">
                    {yourTurn && (
                      <span className="rounded-full border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 text-foreground">
                        your turn
                      </span>
                    )}
                    {c.open_questions > 0 && (
                      <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-foreground">
                        {c.open_questions} unanswered
                      </span>
                    )}
                    {c.decided_template_id && (
                      <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-foreground">
                        decided
                      </span>
                    )}
                  </div>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {c.client_name ? `${c.client_name} · ` : ''}
                  {c.template_ids.length} option{c.template_ids.length === 1 ? '' : 's'} ·{' '}
                  {c.message_count} message{c.message_count === 1 ? '' : 's'} · {c.status}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
