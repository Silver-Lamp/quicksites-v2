import { useCallback } from 'react';

export function useUrlBuilder() {
  const build = useCallback(
    (
      base: string,
      query?: Record<string, string | number | boolean>
    ): string => {
      if (!query) return base;
      const qs = new URLSearchParams();
      for (const key in query) {
        if (query[key] !== undefined) qs.set(key, String(query[key]));
      }
      return `${base}?${qs.toString()}`;
    },
    []
  );

  const getTemplateUrl = useCallback(
    (id: string, query?: Record<string, string | number | boolean>) => {
      return build(`/templates/${id}`, query);
    },
    [build]
  );

  const getSnapshotUrl = useCallback(
    (id: string, query?: Record<string, string | number | boolean>) => {
      return build(`/shared/${id}`, query);
    },
    [build]
  );

  return {
    build,
    getTemplateUrl,
    getSnapshotUrl,
  };
}
