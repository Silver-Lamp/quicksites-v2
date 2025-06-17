// hooks/useLatestTemplate.ts
import { useEffect, useState } from 'react';

export function useLatestTemplate(templateName: string) {
  const [template, setTemplate] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!templateName) return;

    setLoading(true);
    fetch(`/api/templates/history?name=${templateName}`)
      .then((res) => res.json())
      .then((data) => {
        setTemplate(data?.[0] || null); // use most recent version
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Error fetching template');
        setLoading(false);
      });
  }, [templateName]);

  return { template, loading, error };
}
