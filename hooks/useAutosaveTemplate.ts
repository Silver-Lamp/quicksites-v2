// hooks/useAutosaveTemplate.ts
import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';

export function useAutosaveTemplate(template: any, rawJson: string) {
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const lastSave = useRef('');

  useEffect(() => {
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
  }, [rawJson]);

  const restore = () => {
    const saved = localStorage.getItem(`draft-${template.id}`);
    return saved || '';
  };

  const clear = () => {
    localStorage.removeItem(`draft-${template.id}`);
  };

  return { status, restore, clear };
}
