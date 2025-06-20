'use client';

import { useEffect, useState } from 'react';

export function useLiveTableWrapper<T>(table: string, filter: any, sort: any): T[] {
  const [data, setData] = useState<T[]>([]);

  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      const mod = await import('./useLiveTable.jsx');
      const result = mod.useLiveTable<{ id: string | number } & T>(table, filter, sort);
      if (mounted) setData(result);
    };

    fetchData();

    return () => {
      mounted = false;
    };
  }, [table, JSON.stringify(filter), JSON.stringify(sort)]);

  return data;
}
