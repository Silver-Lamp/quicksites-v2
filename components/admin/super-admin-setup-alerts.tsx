'use client';

// components/admin/super-admin-setup-alerts.tsx
//
// The "Setup" alert card: super-admin one-time provisioning tasks (seed the author
// demo, seed starters) as surfaced, one-click action items instead of console
// incantations. Reads state from /api/admin/setup/status (registry-driven —
// lib/admin/setupActions.ts), runs the endpoint on click, re-checks after. Renders
// nothing when everything's done, so it's invisible once the account is set up.

import * as React from 'react';

type SetupAction = {
  key: string;
  title: string;
  detail: string;
  cta: string;
  runEndpoint: string;
  runBody?: Record<string, any>;
  done: boolean;
  resultHref?: string;
  count?: number;
};

export default function SuperAdminSetupAlerts() {
  const [actions, setActions] = React.useState<SetupAction[] | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState<{ key: string; ok: boolean; text: string } | null>(null);
  const [showDone, setShowDone] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch('/api/admin/setup/status', { cache: 'no-store' });
      const j = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(j.actions)) setActions(j.actions);
      else setActions([]);
    } catch {
      setActions([]);
    }
  }, []);
  React.useEffect(() => { void load(); }, [load]);

  const run = async (a: SetupAction) => {
    if (busy) return;
    setBusy(a.key);
    setMsg(null);
    try {
      const res = await fetch(a.runEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(a.runBody ?? {}),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || `failed (${res.status})`);
      const created = j.created ?? j.items ?? (j.status === 'created' ? 1 : 0);
      setMsg({ key: a.key, ok: true, text: `Done — ${typeof created === 'number' ? `${created} created` : 'complete'}.` });
      await load();
    } catch (e: any) {
      setMsg({ key: a.key, ok: false, text: e?.message || 'Run failed.' });
    } finally {
      setBusy(null);
    }
  };

  if (!actions) return null;
  const pending = actions.filter((a) => !a.done);
  const done = actions.filter((a) => a.done);
  if (!pending.length && !done.length) return null;

  return (
    <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-amber-200">
          ⚙️ Setup {pending.length > 0 && <span className="ml-1 rounded-full bg-amber-500/30 px-2 py-0.5 text-xs">{pending.length}</span>}
        </h2>
        {done.length > 0 && (
          <button onClick={() => setShowDone((v) => !v)} className="text-xs text-neutral-400 hover:text-neutral-200">
            {showDone ? 'Hide done' : `${done.length} done`}
          </button>
        )}
      </div>

      {pending.length === 0 ? (
        <p className="mt-2 text-sm text-emerald-400/80">All setup actions complete ✓</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {pending.map((a) => (
            <li key={a.key} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-800 bg-neutral-900/50 p-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-neutral-100">
                  {a.title}
                  {typeof a.count === 'number' && <span className="ml-2 text-xs text-neutral-500">({a.count} so far)</span>}
                </div>
                <div className="text-xs text-neutral-400">{a.detail}</div>
                {msg?.key === a.key && (
                  <div className={`mt-1 text-xs ${msg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{msg.text}</div>
                )}
              </div>
              <button
                onClick={() => void run(a)}
                disabled={busy === a.key}
                className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
              >
                {busy === a.key ? 'Running…' : a.cta}
              </button>
            </li>
          ))}
        </ul>
      )}

      {showDone && done.length > 0 && (
        <ul className="mt-3 space-y-1.5 border-t border-amber-500/15 pt-3">
          {done.map((a) => (
            <li key={a.key} className="flex items-center justify-between gap-3 text-xs text-neutral-500">
              <span>✓ {a.title}{typeof a.count === 'number' ? ` (${a.count})` : ''}</span>
              {a.resultHref && (
                <a href={a.resultHref} target="_blank" rel="noreferrer" className="text-sky-400 hover:underline">
                  View ↗
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
