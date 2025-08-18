'use client';

import * as React from 'react';

export function useRunner() {
  const [busy, setBusy] = React.useState<string | null>(null);
  const [out, setOut] = React.useState<Record<string, any> | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  // prevent double-init in StrictMode (no-op in production)
  const didInit = React.useRef(false);
  React.useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    return () => {
      // cleanup
    };
  }, []);

  const run = async (label: string, fn: () => Promise<any>) => {
    setBusy(label);
    setErr(null);
    setOut(null);
    try {
      const d = await fn();
      setOut(d);
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(null);
    }
  };

  return { busy, out, err, run };
}
