// components/admin/traces/trace-filter-controls.tsx
'use client';

import { useState } from 'react';

type TraceFilterControlsProps = {
  initialRole?: string;
  initialVariant?: string;
  initialSession?: string;
  entries: any[];
  onChange: (filtered: any[]) => void;
};

export function TraceFilterControls({
  entries,
  onChange,
}: TraceFilterControlsProps) {
  const [role, setRole] = useState<string>('all');
  const [variant, setVariant] = useState<string>('all');
  const [session, setSession] = useState<string>('all');

  const allRoles = Array.from(new Set(entries.map((e) => e.role).filter(Boolean)));
  const allVariants = Array.from(new Set(entries.map((e) => e.ab_variant).filter(Boolean)));
  const allSessions = Array.from(new Set(entries.map((e) => e.session_id).filter(Boolean)));

  const applyFilter = () => {
    const filtered = entries.filter((entry) => {
      return (
        (role === 'all' || entry.role === role) &&
        (variant === 'all' || entry.ab_variant === variant) &&
        (session === 'all' || entry.session_id === session)
      );
    });
    onChange(filtered);
  };

  return (
    <div className="mb-6 flex gap-4 items-center text-sm text-zinc-200">
      <select
        value={role}
        onChange={(e) => { setRole(e.target.value); applyFilter(); }}
        className="bg-zinc-800 border border-zinc-600 rounded px-2 py-1"
      >
        <option value="all">All Roles</option>
        {allRoles.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>

      <select
        value={variant}
        onChange={(e) => { setVariant(e.target.value); applyFilter(); }}
        className="bg-zinc-800 border border-zinc-600 rounded px-2 py-1"
      >
        <option value="all">All A/B Variants</option>
        {allVariants.map((v) => <option key={v} value={v}>{v}</option>)}
      </select>

      <select
        value={session}
        onChange={(e) => { setSession(e.target.value); applyFilter(); }}
        className="bg-zinc-800 border border-zinc-600 rounded px-2 py-1"
      >
        <option value="all">All Sessions</option>
        {allSessions.map((s) => <option key={s} value={s}>{s.slice(0, 8)}...</option>)}
      </select>
    </div>
  );
}
