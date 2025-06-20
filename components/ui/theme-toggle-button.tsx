'use client';
import { useTheme } from 'next-themes';

export function ThemeToggleButton() {
  const { theme, setTheme } = useTheme();

  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="px-3 py-1 rounded bg-surface border border-zinc-600 text-accent hover:bg-zinc-800 text-sm"
    >
      {theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode'}
    </button>
  );
}
