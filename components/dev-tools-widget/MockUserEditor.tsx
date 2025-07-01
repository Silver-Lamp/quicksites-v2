// components/dev-tools-widget/MockUserEditor.tsx
'use client';

import { useState } from 'react';
import { SectionToggle } from './SectionToggle';

export function MockUserEditor({
  cookies,
  onChange,
  onDelete,
  collapsedByDefault,
}: {
  cookies: { [key: string]: string };
  onChange: (key: string, value: string) => void;
  onDelete: (key: string) => void;
  collapsedByDefault?: boolean;
}) {
  const [email, setEmail] = useState(cookies['mock-user-email'] || '');
  const [id, setId] = useState(cookies['mock-user-id'] || '');
  const [role, setRole] = useState(cookies['mock-user-role'] || 'viewer');

  const handleSave = () => {
    onChange('mock-user-email', email);
    onChange('mock-user-id', id);
    onChange('mock-user-role', role);
  };

  const handleClear = () => {
    onDelete('mock-user-email');
    onDelete('mock-user-id');
    onDelete('mock-user-role');
    setEmail('');
    setId('');
    setRole('viewer');
  };

  return (
    <SectionToggle title="🧪 Mock User" collapsedByDefault={collapsedByDefault}>
      <div className="space-y-2 text-xs">
        <div className="flex flex-col">
          <label className="text-zinc-400">Email</label>
          <input
            className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="test@example.com"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-zinc-400">User ID</label>
          <input
            className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1"
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder="uuid..."
          />
        </div>
        <div className="flex flex-col">
          <label className="text-zinc-400">Role</label>
          <select
            className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="viewer">viewer</option>
            <option value="reseller">reseller</option>
            <option value="admin">admin</option>
            <option value="owner">owner</option>
          </select>
        </div>
        <div className="flex justify-between pt-2">
          <button
            className="text-green-400 underline"
            onClick={handleSave}
          >
            Save
          </button>
          <button
            className="text-red-400 underline"
            onClick={handleClear}
          >
            Clear
          </button>
        </div>
      </div>
    </SectionToggle>
  );
}
