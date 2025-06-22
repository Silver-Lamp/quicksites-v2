export function NavBadge({ flag }: { flag?: string }) {
    if (!flag) return null;
  
    const color =
      flag === 'beta' ? 'bg-yellow-500' :
      flag === 'internal' ? 'bg-zinc-500' :
      flag === 'labs' ? 'bg-green-600' : 'bg-blue-500';
  
    return (
      <span
        className={`ml-2 inline-block text-[10px] font-bold uppercase tracking-wide text-white px-1.5 py-0.5 rounded ${color}`}
      >
        {flag}
      </span>
    );
  }
  