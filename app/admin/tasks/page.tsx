// app/admin/tasks/page.tsx — internal task tracker dashboard. Admin-gated.
import { createClient } from '@supabase/supabase-js';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { type AdminTask, type TaskStatus } from '@/lib/tasks/constants';
import TasksBoard from './board';

export const dynamic = 'force-dynamic';

export default async function AdminTasksPage() {
  const admin = await getAdminUser();
  if (!admin) {
    return <div className="mx-auto max-w-3xl px-6 py-10 text-sm text-red-500">Admin access required.</div>;
  }

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

  const { data } = await db
    .from('admin_tasks')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);
  const tasks = (data as AdminTask[] | null) ?? [];

  const counts = tasks.reduce<Record<TaskStatus, number>>(
    (acc, t) => ((acc[t.status] = (acc[t.status] ?? 0) + 1), acc),
    { open: 0, in_progress: 0, blocked: 0, done: 0, cancelled: 0 },
  );

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Tasks</h1>
      <p className="mt-2 text-sm text-neutral-400">
        Internal follow-ups and TODOs, tracked in the DB. Add, prioritize, and move items through
        their lifecycle.
      </p>

      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        <span className="text-neutral-400">{tasks.length} total:</span>
        {counts.in_progress ? <span className="text-sky-300">{counts.in_progress} in progress</span> : null}
        {counts.blocked ? <span className="text-red-300">{counts.blocked} blocked</span> : null}
        {counts.open ? <span className="text-amber-300">{counts.open} open</span> : null}
        {counts.done ? <span className="text-emerald-300">{counts.done} done</span> : null}
        {counts.cancelled ? <span className="text-neutral-500">{counts.cancelled} cancelled</span> : null}
      </div>

      <div className="mt-6">
        <TasksBoard initial={tasks} />
      </div>
    </div>
  );
}
