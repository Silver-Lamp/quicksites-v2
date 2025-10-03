// components/admin/templates/panels/useCompanyHours.ts
'use client';

import { useCallback, useEffect, useState } from 'react';
import type { HoursOfOperationContent } from '@/admin/lib/zod/blockSchema';

export function useCompanyHours(companyId?: string | null) {
  const [hours, setHours] = useState<HoursOfOperationContent | null>(null);
  const [loading, setLoading] = useState<boolean>(!!companyId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    let alive = true;
    setLoading(true);
    fetch(`/api/companies/hours?company_id=${encodeURIComponent(companyId)}`)
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        if (j?.error) setError(String(j.error));
        else {
          setHours(j?.hours ?? null);
          setError(null);
        }
      })
      .catch((e) => alive && setError(String(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [companyId]);

  const save = useCallback(
    async (next: HoursOfOperationContent) => {
      if (!companyId) return { ok: false, error: 'company_id missing' };
      const res = await fetch('/api/companies/hours', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ company_id: companyId, hours: next }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j?.error) return { ok: false, error: j?.error || 'Save failed' };
      setHours(next);
      return { ok: true };
    },
    [companyId]
  );

  return { hours, setHours, save, loading, error };
}
