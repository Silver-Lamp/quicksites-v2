import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const routes = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Sites', path: '/admin/sites' },
  { label: 'Themes', path: '/admin/branding' },
  { label: 'Templates', path: '/admin/templates' },
  { label: 'Docs', path: '/admin/docs' },
  { label: 'Gallery', path: '/gallery' },
];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const router = useRouter();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const filtered = routes.filter((r) => r.label.toLowerCase().includes(query.toLowerCase()));

  return (
    open && (
      <div className="fixed inset-0 bg-black/50 z-50 flex justify-center items-start pt-24">
        <div className="bg-white rounded shadow-lg w-96 p-4 space-y-2">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full border p-2 rounded text-sm"
            placeholder="Jump to..."
          />
          <ul className="space-y-1 text-sm">
            {filtered.map((r) => (
              <li key={r.path}>
                <button
                  onClick={() => {
                    router.push(r.path);
                    setOpen(false);
                  }}
                  className="w-full text-left hover:bg-gray-100 p-2 rounded"
                >
                  {r.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    )
  );
}
