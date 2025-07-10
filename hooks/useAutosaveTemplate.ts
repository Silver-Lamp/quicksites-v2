 // hooks/useAutosaveTemplate.ts
import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';

export function useAutosaveTemplate(template: any, rawJson: string) {
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const lastSave = useRef('');

  useEffect(() => {
    if (!template?.id || template.id.length < 8) return; // 🛡️ Don't autosave yet

    const timeout = setTimeout(() => {
      if (rawJson !== lastSave.current) {
        setStatus('saving');
        localStorage.setItem(`draft-${template.id}`, rawJson);
        lastSave.current = rawJson;
        setStatus('saved');
        // toast.success('Changes autosaved');
      }
    }, 2000);

    return () => clearTimeout(timeout);
  }, [rawJson, template?.id]); // 👈 also track id in case it gets populated later

  const restore = () => {
    if (!template?.id || template.id.length < 8) return '';
    return localStorage.getItem(`draft-${template.id}`) || '';
  };

  const clear = () => {
    if (!template?.id || template.id.length < 8) return;
    localStorage.removeItem(`draft-${template.id}`);
  };

  return { status, restore, clear };
}
