import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

export function useQueryFlash(key: string): string | null {
  const router = useRouter();
  const [value, setValue] = useState<string | null>(null);

  useEffect(() => {
    const param = router.query[key];
    if (param && typeof param === 'string') {
      setValue(param);

      // Strip it from the URL without full reload
      const { [key]: _, ...rest } = router.query;
      router.replace({ pathname: router.pathname, query: rest }, undefined, { shallow: true });
    }
  }, [router.query[key]]); // re-run if query changes

  return value;
}
