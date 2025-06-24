import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export function useQueryFlash(key: string): string | null {
  const searchParams = useSearchParams();
  const [value, setValue] = useState<string | null>(null);

  useEffect(() => {
    const param = searchParams?.get(key);
    if (param && typeof param === 'string') {
      setValue(param);

      // Strip it from the URL without full reload
      const rest = new URLSearchParams(searchParams?.toString() || '');
      rest.delete(key);
      window.location.href = `${window.location.pathname}?${rest.toString()}`;
    }
  }, [searchParams?.get(key)]); // re-run if query changes

  return value;
}
