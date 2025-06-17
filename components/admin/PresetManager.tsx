// components/PresetManager.tsx
import { useRouter } from 'next/router';
import { extractTags, summarizeQuery } from '@/admin/lib/queryUtils';

export default function PresetManager({
  slug,
  presets,
  tagFilter,
  tagMatchMode,
  onDelete,
}: {
  slug: string;
  presets: Record<string, string>;
  tagFilter: string[];
  tagMatchMode: 'all' | 'any';
  onDelete: (name: string) => void;
}) {
  const router = useRouter();
  const groupedTags = [
    ...new Set(
      Object.values(presets).flatMap((q) =>
        extractTags(q).map((t) => t.toLowerCase())
      )
    ),
  ];

  return (
    <div className="flex flex-col gap-3">
      {groupedTags.map((groupTag) => {
        const groupPresets = Object.entries(presets)
          .filter(([_, query]) => {
            const tags = extractTags(query).map((t) => t.toLowerCase());
            return tagMatchMode === 'all'
              ? tagFilter.every((f) => tags.includes(f))
              : tagFilter.some((f) => tags.includes(f));
          })
          .filter(([_, query]) =>
            extractTags(query)
              .map((t) => t.toLowerCase())
              .includes(groupTag)
          );

        if (groupPresets.length === 0) return null;

        return (
          <div key={groupTag} className="mb-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-1">
              #{groupTag}
            </h4>
            <ul className="space-y-1">
              {groupPresets.map(([name, query]) => (
                <li
                  key={name}
                  className="flex justify-between items-start gap-2"
                >
                  <div>
                    <button
                      onClick={() =>
                        router.push(`/admin/param-lab?slug=${slug}&${query}`)
                      }
                      className="text-blue-600 underline text-sm"
                    >
                      {name}
                    </button>
                    <span className="block text-xs text-gray-500 ml-1">
                      {summarizeQuery(query)}
                    </span>
                  </div>
                  <div className="flex gap-1 pt-1">
                    <button
                      onClick={() =>
                        navigator.clipboard.writeText(
                          `${window.location.origin}/admin/param-lab?slug=${slug}&${query}`
                        )
                      }
                      className="text-xs text-yellow-600"
                    >
                      🔗
                    </button>
                    <button
                      onClick={() => onDelete(name)}
                      className="text-xs text-red-500"
                    >
                      ✕
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
