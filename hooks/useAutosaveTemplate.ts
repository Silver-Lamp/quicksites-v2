'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Remove heavy / transient fields so drafts don't blow up storage.
 * - strips strings that look like base64 `data:` URIs
 * - drops keys commonly used for previews: *_data_url, b64, b64_json, preview, temp
 */
function draftReplacer(key: string, value: any) {
  // Drop known heavy keys
  if (typeof key === 'string') {
    const lower = key.toLowerCase();
    if (
      lower.endsWith('_data_url') ||
      lower === 'b64' ||
      lower === 'b64_json' ||
      lower === 'preview' ||
      lower === 'temp' ||
      lower === 'logo_data_url' ||
      lower === 'hero_data_url' ||
      lower === 'image_data_url'
    ) {
      return undefined;
    }
  }

  // Drop huge data URLs anywhere in the object
  if (typeof value === 'string' && value.length > 100_000) {
    if (value.startsWith('data:image') || value.startsWith('data:')) {
      return undefined;
    }
  }

  return value;
}

/**
 * Serialize a template safely for autosave.
 * Returns a compact JSON string (no spaces) that excludes heavy fields.
 */
function makeDraftJson(template: any): string {
  try {
    // You can further narrow what you persist (e.g., only data/pages & identity fields)
    return JSON.stringify(template, draftReplacer);
  } catch {
    // Worst case: attempt best‐effort stringify of a shallow clone
    try {
      return JSON.stringify({ id: template?.id, data: template?.data, meta: template?.meta });
    } catch {
      return '{}';
    }
  }
}

function safeStore(key: string, raw: string): 'local' | 'session' | null {
  // Prefer localStorage, but handle quota
  try {
    localStorage.setItem(key, raw);
    return 'local';
  } catch (err: any) {
    // Fall back to sessionStorage
    try {
      sessionStorage.setItem(key, raw);
      return 'session';
    } catch {
      // Nothing else we can do (IndexedDB would be next, but out of scope here)
      // Swallow the error to avoid crashing React.
      return null;
    }
  }
}

function safeRemove(key: string) {
  try { localStorage.removeItem(key); } catch {}
  try { sessionStorage.removeItem(key); } catch {}
}

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'skipped' | 'error';

/**
 * useAutosaveTemplate
 * Debounced, sanitized autosave of a template draft to storage.
 *
 * @param template   The current template object
 * @param delayMs    Debounce delay (default 800ms)
 * @returns { status, clear }
 */
export function useAutosaveTemplate(template: any, delayMs = 800) {
  const [status, setStatus] = useState<AutosaveStatus>('idle');
  const lastSave = useRef<string>('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!template?.id) return;

    // Debounce each change
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      try {
        const raw = makeDraftJson(template);

        // Only write if changed
        if (raw === lastSave.current) {
          setStatus('idle');
          return;
        }

        setStatus('saving');

        // If raw is massive, prefer sessionStorage directly to avoid filling localStorage
        const size = raw.length; // char count ~ bytes for ASCII
        const key = `draft-${template.id}`;
        let where: 'local' | 'session' | null = null;

        if (size > 4_000_000) {
          // ~4MB threshold — store in session instead
          where = safeStore(key, raw);
        } else {
          where = safeStore(key, raw);
        }

        lastSave.current = raw;
        setStatus(where ? 'saved' : 'skipped');
      } catch {
        setStatus('error');
      }
    }, delayMs);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [template, delayMs]);

  // Helper to manually clear draft
  const clear = () => {
    if (!template?.id) return;
    const key = `draft-${template.id}`;
    safeRemove(key);
    lastSave.current = '';
    setStatus('idle');
  };

  return { status, clear };
}
