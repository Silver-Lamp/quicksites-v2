'use client';

import * as React from 'react';

type ToolLink = { id: string; label: string };
export type ToolGroup = { title: string; items: ToolLink[] };

export function LeftNav({
  groups,
  activeId,
  onSelect,
  showBackToTop = true,
}: {
  groups: ToolGroup[];
  activeId?: string | null;
  onSelect: (id: string) => void;
  showBackToTop?: boolean;
}) {
  const [q, setQ] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Press "/" anywhere to focus search
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const isTyping =
        el?.tagName?.toLowerCase() === 'input' ||
        el?.tagName?.toLowerCase() === 'textarea' ||
        el?.isContentEditable;
      if (!isTyping && e.key === '/') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const flat = React.useMemo(
    () => groups.flatMap((g) => g.items),
    [groups]
  );

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return null; // null = show grouped view
    return flat.filter((t) => t.label.toLowerCase().includes(needle));
  }, [flat, q]);

  const scrollToTop = () => {
    const top = document.getElementById('top');
    if (top) top.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <aside className="lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)] lg:overflow-auto">
      <div className="rounded-xl border p-3">
        <div className="mb-2">
          <label className="sr-only" htmlFor="tool-search">Filter tools</label>
          <input
            id="tool-search"
            ref={inputRef}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Filter tools… ( / )"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        {/* Search results (flat) */}
        {filtered && (
          <nav aria-label="Search results">
            <p className="px-1 pb-1 text-xs text-muted-foreground">
              {filtered.length} match{filtered.length === 1 ? '' : 'es'}
            </p>
            <ul className="space-y-0.5">
              {filtered.map((t) => {
                const active = t.id === activeId;
                return (
                  <li key={t.id}>
                    <button
                      className={[
                        'w-full text-left rounded-md px-2 py-1.5 text-sm transition',
                        active ? 'bg-muted font-medium' : 'hover:bg-muted',
                      ].join(' ')}
                      aria-current={active ? 'page' : undefined}
                      onClick={() => onSelect(t.id)}
                    >
                      {t.label}
                    </button>
                  </li>
                );
              })}
              {filtered.length === 0 && (
                <li className="px-2 py-1.5 text-xs text-muted-foreground">
                  No matches
                </li>
              )}
            </ul>
          </nav>
        )}

        {/* Grouped view */}
        {!filtered && (
          <nav aria-label="Admin tools">
            <ul className="space-y-3">
              {groups.map((g) => {
                const groupActive = g.items.some((i) => i.id === activeId);
                return (
                  <li key={g.title}>
                    <div className="px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {g.title}
                    </div>
                    <ul className="space-y-0.5">
                      {g.items.map((t) => {
                        const active = t.id === activeId;
                        return (
                          <li key={t.id}>
                            <button
                              className={[
                                'w-full text-left rounded-md px-2 py-1.5 text-sm transition',
                                active
                                  ? 'bg-muted font-medium'
                                  : 'hover:bg-muted',
                                groupActive && !active
                                  ? 'ring-0'
                                  : undefined,
                              ].join(' ')}
                              aria-current={active ? 'page' : undefined}
                              onClick={() => onSelect(t.id)}
                            >
                              {t.label}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}

        {showBackToTop && (
          <div className="mt-3 border-t pt-3">
            <button
              className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
              onClick={scrollToTop}
            >
              ↑ Back to top
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
