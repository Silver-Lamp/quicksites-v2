'use client';
import clsx from 'clsx';

export function ProgressSteps({
  model,
  active,
  done,
  percent,
  notes,
}: {
  model: { key:string; label:string }[];
  active: string | null;
  done: Record<string, boolean>;
  percent: number;
  notes?: string[];
}) {
  return (
    <div className="space-y-3">
      <div className="h-2 w-full overflow-hidden rounded bg-muted">
        <div
          className="h-2 bg-primary transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
      <ul className="grid gap-2 md:grid-cols-2">
        {model.map(({ key, label }) => {
          const state = done[key] ? 'done' : (active === key ? 'active' : 'todo');
          return (
            <li key={key} className="flex items-center gap-2 text-sm">
              <span
                className={clsx(
                  'inline-flex h-5 w-5 items-center justify-center rounded-full border text-[11px]',
                  state === 'done'   && 'bg-green-500/10 border-green-500 text-green-700',
                  state === 'active' && 'bg-primary/10 border-primary text-primary',
                  state === 'todo'   && 'border-muted-foreground/30 text-muted-foreground'
                )}
              >
                {state === 'done' ? '✓' : state === 'active' ? '•' : '–'}
              </span>
              <span className={clsx(state === 'todo' && 'text-muted-foreground')}>{label}</span>
            </li>
          );
        })}
      </ul>
      {!!(notes && notes.length) && (
        <div className="rounded-md border p-2 text-xs text-muted-foreground">
          {notes.slice(-3).map((n, i)=><div key={i}>{n}</div>)}
        </div>
      )}
    </div>
  );
}
