import { useState, useEffect } from 'react';

export function useAutosaveToggle(templateId: string) {
  const key = `autosave-paused-${templateId}`;
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(key);
    if (stored === 'true') {
      setPaused(true);
    }
  }, [key]);

  const toggle = () => {
    const next = !paused;
    setPaused(next);
    localStorage.setItem(key, String(next));
  };

  return { paused, toggle };
}
