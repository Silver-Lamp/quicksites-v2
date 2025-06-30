// hooks/useRequestMeta.ts
'use client';

import { useMemo } from 'react';

export function useRequestMeta() {
  const body = typeof document !== 'undefined' ? document.body : null;

  return useMemo(() => {
    return {
      traceId: body?.dataset?.traceId ?? '',
      sessionId: body?.dataset?.sessionId ?? '',
      abVariant: body?.dataset?.abVariant ?? '',
      userRole: body?.dataset?.userRole ?? '',
      userId: body?.dataset?.userId ?? '',
      userEmail: body?.dataset?.userEmail ?? '',
    };
  }, [body?.dataset?.traceId, body?.dataset?.sessionId, body?.dataset?.abVariant]);
}
