'use client';

import { useEffect, useState } from 'react';

export default function ThemeDebugger({
  targetId = 'preview-capture',
}: {
  targetId?: string;
}) {
  const [theme, setTheme] = useState<'light' | 'dark' | 'unknown'>('unknown');
  const [bg, setBg] = useState('');
  const [text, setText] = useState('');

  useEffect(() => {
    const el = document.getElementById(targetId);
    if (!el) return;

    const isDark = el.closest('.dark');
    setTheme(isDark ? 'dark' : 'light');

    const style = getComputedStyle(el);
    setBg(style.backgroundColor);
    setText(style.color);
  }, [targetId]);

  return (
    <div className="text-xs p-2 mt-2 rounded bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 border border-yellow-300 dark:border-yellow-500">
      <div className="font-semibold">[Theme Debugger]</div>
      <div>Target: <code>#{targetId}</code></div>
      <div>Scope: <strong>{theme}</strong></div>
      <div>Computed Background: <code>{bg}</code></div>
      <div>Computed Text: <code>{text}</code></div>
    </div>
  );
}
