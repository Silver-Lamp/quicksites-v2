// components/page-edit-fields.tsx
'use client';

import { useEffect, useState } from 'react';
import { generateSlug } from '@/lib/utils/generateSlug'; // Adjust this path if needed

interface PageEditFieldsProps {
  initialTitle: string;
  initialSlug: string;
  existingSlugs: Set<string>;
  onSave: (newTitle: string, newSlug: string) => void;
  onCancel: () => void;
}

export function PageEditFields({
  initialTitle,
  initialSlug,
  existingSlugs,
  onSave,
  onCancel,
}: PageEditFieldsProps) {
  const [title, setTitle] = useState(initialTitle);
  const [slug, setSlug] = useState(initialSlug);

  useEffect(() => {
    const newSlug = generateSlug(title);
    setSlug(newSlug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title]);

  return (
    <div className="flex flex-col gap-2 w-full">
      <input
        className="bg-neutral-800 border border-neutral-600 px-2 py-1 rounded text-white"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Page title"
        autoFocus
      />

      <div className="flex items-center gap-2">
        <div className="text-white/60">/</div>
        <input
          className="flex-1 bg-neutral-800 border border-neutral-600 px-2 py-1 rounded text-white"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="Slug (e.g. about-us)"
        />
        <button
          onClick={() => onSave(title, slug)}
          className="ml-2 px-3 py-1 text-sm text-white bg-green-600 hover:bg-green-700 rounded"
        >
          Save
        </button>
      </div>
    </div>
  );
}
