import { useSmartLinkPersisted } from './useSmartLinkPersisted';

import { useEffect, useState } from 'react';

export default function SmartLinkDebug() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const toggle = (e: KeyboardEvent) => {
      if (e.shiftKey && e.key.toLowerCase() === 'd') setVisible(v => !v);
    };
    window.addEventListener('keydown', toggle);
    return () => window.removeEventListener('keydown', toggle);
  }, []);

  useEffect(() => {
    if (visible) {
      const toast = document.createElement('div');
      toast.textContent = '🧪 SmartLink Debug Activated';
      toast.style.position = 'fixed';
      toast.style.bottom = '1rem';
      toast.style.right = '1rem';
      toast.style.background = '#333';
      toast.style.color = '#fff';
      toast.style.padding = '0.5rem 1rem';
      toast.style.borderRadius = '0.25rem';
      toast.style.fontSize = '0.75rem';
      toast.style.zIndex = '9999';
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 2000);
    }
  }, [visible]);

  if (!visible) return null;
  const { theme, query, setTheme, setQuery } = useSmartLinkPersisted();

  return (
    <div className="fixed bottom-4 right-4 bg-zinc-900 text-white p-4 rounded shadow-lg text-sm space-y-2">
      <h2 className="font-semibold">🔧 SmartLink Debug</h2>
      <div>
        <label className="block text-xs text-zinc-400 mb-1">Theme</label>
        <select
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          className="bg-zinc-800 border border-zinc-600 rounded px-2 py-1 w-full"
        >
          <option value="primary">Primary</option>
          <option value="muted">Muted</option>
          <option value="danger">Danger</option>
          <option value="outline">Outline</option>
        </select>
      </div>
      <div>
        <label className="block text-xs text-zinc-400 mb-1">Query JSON</label>
        <textarea
          className="bg-zinc-800 border border-zinc-600 rounded px-2 py-1 w-full"
          rows={3}
          value={JSON.stringify(query, null, 2)}
          onChange={(e) => {
            try {
              setQuery(JSON.parse(e.target.value));
            } catch {}
          }}
        />
      </div>
      <button
        className="text-red-400 text-xs underline"
        onClick={() => {
          setTheme('primary');
          setQuery({});
        }}
      >
        Reset SmartLink Settings
      </button>
    </div>
  );
}
