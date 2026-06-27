'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  type AdminTask,
  type TaskStatus,
  type TaskPriority,
  TASK_STATUSES,
  TASK_PRIORITIES,
  STATUS_LABEL,
  PRIORITY_LABEL,
  sortTasks,
} from '@/lib/tasks/constants';

const STATUS_STYLE: Record<TaskStatus, string> = {
  open: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
  in_progress: 'text-sky-300 bg-sky-500/10 border-sky-500/30',
  blocked: 'text-red-300 bg-red-500/10 border-red-500/30',
  done: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
  cancelled: 'text-neutral-400 bg-neutral-500/10 border-neutral-700',
};

const PRIORITY_STYLE: Record<TaskPriority, string> = {
  urgent: 'text-red-300',
  high: 'text-orange-300',
  medium: 'text-neutral-300',
  low: 'text-neutral-500',
};

function ago(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const d = Math.floor(ms / 86_400_000);
  if (d > 0) return `${d}d ago`;
  const h = Math.floor(ms / 3_600_000);
  if (h > 0) return `${h}h ago`;
  const m = Math.floor(ms / 60_000);
  return m > 0 ? `${m}m ago` : 'just now';
}

export default function TasksBoard({ initial }: { initial: AdminTask[] }) {
  const router = useRouter();
  const [tasks, setTasks] = React.useState<AdminTask[]>(initial);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [showDone, setShowDone] = React.useState(false);

  // New-task form
  const [title, setTitle] = React.useState('');
  const [priority, setPriority] = React.useState<TaskPriority>('medium');
  const [category, setCategory] = React.useState('');

  React.useEffect(() => setTasks(initial), [initial]);

  const patch = async (id: string, body: Partial<AdminTask>) => {
    setBusy(id);
    setError(null);
    // optimistic
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...body } as AdminTask : t)));
    try {
      const res = await fetch(`/api/admin/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `failed (${res.status})`);
      setTasks((prev) => prev.map((t) => (t.id === id ? (json.task as AdminTask) : t)));
    } catch (e: any) {
      setError(e.message);
      router.refresh();
    } finally {
      setBusy(null);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this task?')) return;
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/tasks/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `failed (${res.status})`);
      setTasks((prev) => prev.filter((t) => t.id !== id));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy('new');
    setError(null);
    try {
      const res = await fetch('/api/admin/tasks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), priority, category: category.trim() || undefined, source: 'manual' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `failed (${res.status})`);
      setTasks((prev) => [json.task as AdminTask, ...prev]);
      setTitle('');
      setCategory('');
      setPriority('medium');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const visible = [...tasks]
    .filter((t) => (showDone ? true : t.status !== 'done' && t.status !== 'cancelled'))
    .sort(sortTasks);

  return (
    <div>
      <form onSubmit={add} className="flex flex-wrap items-center gap-2 rounded-xl border border-neutral-800 p-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a task…"
          className="min-w-[14rem] flex-1 rounded-md border border-neutral-700 bg-transparent px-3 py-2 text-sm outline-none focus:border-neutral-500"
        />
        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="category"
          className="w-28 rounded-md border border-neutral-700 bg-transparent px-3 py-2 text-sm outline-none focus:border-neutral-500"
        />
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as TaskPriority)}
          className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-2 text-sm"
        >
          {TASK_PRIORITIES.map((p) => (
            <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
          ))}
        </select>
        <button
          type="submit"
          disabled={busy === 'new' || !title.trim()}
          className="rounded-md bg-sky-500 px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-sky-400 disabled:opacity-50"
        >
          {busy === 'new' ? 'Adding…' : 'Add'}
        </button>
      </form>

      <div className="mt-3 flex items-center justify-between text-xs text-neutral-400">
        <span>{visible.length} shown</span>
        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
          Show done / cancelled
        </label>
      </div>

      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

      <ul className="mt-3 space-y-2">
        {visible.map((t) => {
          const resolved = t.status === 'done' || t.status === 'cancelled';
          return (
            <li
              key={t.id}
              className={`rounded-xl border border-neutral-800 p-4 ${resolved ? 'opacity-60' : ''}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`font-medium ${t.status === 'done' ? 'line-through' : ''}`}>{t.title}</span>
                    <span className={`text-xs font-semibold ${PRIORITY_STYLE[t.priority]}`}>
                      {PRIORITY_LABEL[t.priority]}
                    </span>
                    {t.category ? (
                      <span className="rounded-full border border-neutral-700 px-2 py-0.5 text-xs text-neutral-400">
                        {t.category}
                      </span>
                    ) : null}
                  </div>
                  {t.details ? <p className="mt-1 text-sm text-neutral-400">{t.details}</p> : null}
                  <div className="mt-1 text-xs text-neutral-500">
                    {t.source ? <span className="font-mono">{t.source}</span> : null}
                    {t.source ? ' · ' : ''}added {ago(t.created_at)}
                    {t.completed_at ? ` · done ${ago(t.completed_at)}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={t.status}
                    disabled={busy === t.id}
                    onChange={(e) => patch(t.id, { status: e.target.value as TaskStatus })}
                    className={`rounded-md border px-2 py-1 text-xs ${STATUS_STYLE[t.status]} disabled:opacity-50`}
                  >
                    {TASK_STATUSES.map((s) => (
                      <option key={s} value={s} className="bg-neutral-900 text-neutral-200">
                        {STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => remove(t.id)}
                    disabled={busy === t.id}
                    title="Delete"
                    className="rounded-md border border-neutral-700 px-2 py-1 text-xs text-neutral-400 hover:bg-neutral-800 disabled:opacity-50"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </li>
          );
        })}
        {visible.length === 0 ? (
          <li className="rounded-xl border border-neutral-800 px-4 py-8 text-center text-sm text-neutral-500">
            No tasks. Add one above.
          </li>
        ) : null}
      </ul>
    </div>
  );
}
