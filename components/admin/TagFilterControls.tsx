// components/TagFilterControls.tsx
import { useEffect, useState } from 'react';

export default function TagFilterControls({
  tagFilter,
  setTagFilter,
  tagMatchMode,
  setTagMatchMode,
  allTags,
}: {
  tagFilter: string[];
  setTagFilter: (tags: string[]) => void;
  tagMatchMode: 'any' | 'all';
  setTagMatchMode: (mode: 'any' | 'all') => void;
  allTags: [string, number][];
}) {
  const [manualTag, setManualTag] = useState('');

  const addManualTag = () => {
    const newTag = manualTag.trim().toLowerCase();
    if (newTag && !tagFilter.includes(newTag)) {
      const next = [...tagFilter, newTag];
      setTagFilter(next);
      updateTagURL(next);
    }
    setManualTag('');
  };

  const updateTagURL = (tags: string[]) => {
    const url = new URL(window.location.href);
    if (tags.length > 0) url.searchParams.set('tags', tags.join(','));
    else url.searchParams.delete('tags');
    window.history.replaceState({}, '', url.toString());
  };

  const toggleTag = (tag: string) => {
    const lower = tag.toLowerCase();
    if (!tagFilter.includes(lower)) {
      const next = [...tagFilter, lower];
      setTagFilter(next);
      updateTagURL(next);
    }
  };

  const removeTag = (tag: string) => {
    const next = tagFilter.filter((t) => t !== tag);
    setTagFilter(next);
    updateTagURL(next);
  };

  const toggleMode = () => {
    const next = tagMatchMode === 'all' ? 'any' : 'all';
    setTagMatchMode(next);
    const url = new URL(window.location.href);
    url.searchParams.set('tagMode', next);
    window.history.replaceState({}, '', url.toString());
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Filter by Tag:</label>
      <input
        type="text"
        value={tagFilter.join(', ')}
        onChange={(e) => {
          const next = e.target.value
            .split(',')
            .map((t) => t.trim().toLowerCase())
            .filter(Boolean);
          setTagFilter(next);
          updateTagURL(next);
        }}
        placeholder="e.g. cold, social"
        className="border px-2 py-1 rounded w-full"
      />

      {tagFilter.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {tagFilter.map((tag, i) => (
            <button
              key={i}
              onClick={() => removeTag(tag)}
              className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded hover:bg-blue-200"
            >
              #{tag} ✕
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2 items-center mt-2">
        <input
          value={manualTag}
          onChange={(e) => setManualTag(e.target.value)}
          placeholder="Add tag..."
          className="border px-2 py-1 text-sm rounded"
        />
        <button onClick={addManualTag} className="text-sm bg-blue-700 text-white px-3 py-1 rounded">
          + Add
        </button>
        <label
          title="Click to toggle mode (or press 'm')"
          onClick={toggleMode}
          className="text-xs font-semibold text-gray-700 cursor-pointer"
        >
          Mode:{' '}
          <span
            className={`ml-1 font-bold ${tagMatchMode === 'any' ? 'text-indigo-500' : 'text-green-600'}`}
          >
            {tagMatchMode}
          </span>
        </label>
        <select
          value={tagMatchMode}
          onChange={(e) => {
            const mode = e.target.value as 'any' | 'all';
            setTagMatchMode(mode);
            const url = new URL(window.location.href);
            url.searchParams.set('tagMode', mode);
            window.history.replaceState({}, '', url.toString());
          }}
          className={`text-xs border px-1 py-0.5 rounded text-white ${tagMatchMode === 'any' ? 'bg-indigo-500' : 'bg-green-600'}`}
        >
          <option value="all">Match All</option>
          <option value="any">Match Any</option>
        </select>
      </div>

      {allTags.length > 0 && (
        <div className="space-y-1 mt-4">
          <span className="text-xs text-gray-500">Suggestions (by frequency):</span>
          <div className="flex flex-wrap gap-2">
            {allTags.map(([tag, count], i) => (
              <button
                key={i}
                onClick={() => toggleTag(tag)}
                className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded hover:bg-gray-200"
              >
                #{tag} ({count})
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
