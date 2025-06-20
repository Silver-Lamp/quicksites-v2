'use client';

export function AddBlockMenu({
  available,
  onAdd,
}: {
  available: { id: string; title: string }[];
  onAdd: (block: { id: string; title: string }) => void;
}) {
  return (
    <div className="mb-4">
      <label className="text-sm font-semibold block mb-2">+ Add Block</label>
      <div className="flex gap-2 flex-wrap">
        {available.map((b) => (
          <button
            key={b.id}
            onClick={() => onAdd(b)}
            className="text-xs px-2 py-1 bg-zinc-700 text-white rounded hover:bg-zinc-600"
          >
            {b.title}
          </button>
        ))}
      </div>
    </div>
  );
}
