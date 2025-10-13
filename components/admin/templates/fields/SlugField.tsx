// components/admin/templates/fields/SlugField.tsx
'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';

type Props = {
  initialSlug: string | null;
  templateId: string;
  isPublished?: boolean;
  onSaved?: (slug: string) => void;
};

const normalize = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, '-')       // safe chars
    .replace(/^-+|-+$/g, '')            // trim - at ends
    .replace(/--+/g, '-');              // squash --

export default function SlugField({ initialSlug, templateId, isPublished, onSaved }: Props) {
  const [value, setValue] = useState(initialSlug ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef(initialSlug ?? '');

  const disabled = !!isPublished; // keep your existing banner “Unpublish to edit”

  // Debounced saver – no domain verification here, just slug.
  const save = useCallback(async (slug: string) => {
    if (!slug) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/templates/${templateId}/slug`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to save slug');
      lastSavedRef.current = data.slug;
      onSaved?.(data.slug);
    } catch (e: any) {
      setError(e.message || 'Failed to save slug');
      // Revert UI to last known good, but DO NOT fire verify/connect
      setValue(lastSavedRef.current);
    } finally {
      setSaving(false);
    }
  }, [templateId, onSaved]);

  // Debounce: only save 600ms after user stops typing
  // Fix the effect so the cleanup always returns void
  useEffect(() => {
    if (disabled) return;
  
    // clear any pending timeout first
    if (debRef.current) {
      clearTimeout(debRef.current);
      debRef.current = null;
    }
  
    const normalized = normalize(value);
  
    // keep the field normalized but don't save yet
    if (value !== normalized) {
      setValue(normalized);
      return; // ok to return void (no cleanup)
    }
  
    debRef.current = setTimeout(() => {
      if (normalized && normalized !== lastSavedRef.current) {
        void save(normalized);
      }
    }, 600);
  
    // proper cleanup: never return null
    return () => {
      if (debRef.current) {
        clearTimeout(debRef.current);
        debRef.current = null;
      }
    };
  }, [value, disabled, save]);
  
  return (
    <div className="space-y-1">
      <input
        type="text"
        className="qs-input w-full"
        placeholder="your-subdomain"
        disabled={disabled || saving}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      {saving && <p className="text-xs text-muted-foreground">Saving…</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
