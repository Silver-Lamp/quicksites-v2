export function NavBadge({ flag }: { flag?: string }) {
    if (!flag) return null;
    return (
      <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-zinc-700 text-white uppercase tracking-wide">
        {flag}
      </span>
    );
  }
  