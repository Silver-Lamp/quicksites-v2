// lib/tasks/constants.ts — shared vocabulary for the admin task tracker.

// 'triage' = a machine-reported CLAIM awaiting human confirmation (an AI-persona finding —
// crosstalk/contracts/persona-testing.md). Deliberately distinct from 'open', which reads as
// confirmed work: one bad browse session filing 20 unverified items into the real queue is
// how the queue stops being trusted. Backed by the DB CHECK (migration 20260808).
export const TASK_STATUSES = ['triage', 'open', 'in_progress', 'blocked', 'done', 'cancelled'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export type AdminTask = {
  id: string;
  title: string;
  details: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  category: string | null;
  source: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

export const STATUS_LABEL: Record<TaskStatus, string> = {
  triage: 'Triage (unconfirmed)',
  open: 'Open',
  in_progress: 'In progress',
  blocked: 'Blocked',
  done: 'Done',
  cancelled: 'Cancelled',
};

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

// Lower = shown first. "Active" work floats to the top; resolved sinks.
export const STATUS_ORDER: Record<TaskStatus, number> = {
  in_progress: 0,
  blocked: 1,
  open: 2,
  // Below confirmed work on purpose: triage items are unverified claims, so they must not
  // push real work down the board. Visible, but never competing for attention with it.
  triage: 3,
  done: 4,
  cancelled: 5,
};

export const PRIORITY_ORDER: Record<TaskPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function isStatus(v: unknown): v is TaskStatus {
  return typeof v === 'string' && (TASK_STATUSES as readonly string[]).includes(v);
}

export function isPriority(v: unknown): v is TaskPriority {
  return typeof v === 'string' && (TASK_PRIORITIES as readonly string[]).includes(v);
}

/** Sort active work to the top: status group, then priority, then newest. */
export function sortTasks(a: AdminTask, b: AdminTask): number {
  const s = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
  if (s !== 0) return s;
  const p = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
  if (p !== 0) return p;
  return b.created_at.localeCompare(a.created_at);
}
