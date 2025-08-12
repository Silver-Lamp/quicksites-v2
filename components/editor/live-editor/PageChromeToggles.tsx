'use client';

export default function PageChromeToggles({
  page,
  onToggleHeader,
  onToggleFooter,
}: {
  page: any;
  onToggleHeader: (next: boolean) => void;
  onToggleFooter: (next: boolean) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <span className="text-xs uppercase tracking-wide text-black/60 dark:text-white/60">
        Page Settings:
      </span>

      <button
        type="button"
        onClick={() => onToggleHeader(!(page?.show_header !== false))}
        className={`px-2 py-1 text-xs rounded border transition
          ${page?.show_header !== false
            ? 'bg-emerald-600/20 text-emerald-300 border-emerald-600/40 hover:bg-emerald-600/30'
            : 'bg-zinc-800 text-zinc-300 border-zinc-600 hover:bg-zinc-700'}`}
        title="Show or hide the global header on this page"
      >
        Header: {page?.show_header !== false ? 'Visible' : 'Hidden'}
      </button>

      <button
        type="button"
        onClick={() => onToggleFooter(!(page?.show_footer !== false))}
        className={`px-2 py-1 text-xs rounded border transition
          ${page?.show_footer !== false
            ? 'bg-emerald-600/20 text-emerald-300 border-emerald-600/40 hover:bg-emerald-600/30'
            : 'bg-zinc-800 text-zinc-300 border-zinc-600 hover:bg-zinc-700'}`}
        title="Show or hide the global footer on this page"
      >
        Footer: {page?.show_footer !== false ? 'Visible' : 'Hidden'}
      </button>
    </div>
  );
}
