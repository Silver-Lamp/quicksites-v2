'use client';

import { useState } from 'react';
import { CommandPalette } from './command-palette';

export function AppHeaderButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className="p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
        onClick={() => setOpen(true)}
        title="Command Palette (Cmd+K)"
      >
        🔍
      </button>
      {open && <CommandPalette />}
    </>
  );
}
