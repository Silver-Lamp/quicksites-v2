import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Filter = { column: string; operator: string; value: any };
type Sort = { column: string; ascending?: boolean };

export function useLiveTable<T = any>(
  table: string,
  filter?: Filter,
  sort?: Sort
) {
  const [rows, setRows] = useState<T[]>([]);

  useEffect(() => {
    let mounted = true;

    const fetchInitial = async () => {
      let query = supabase.from(table).select('*');

      if (filter) {
        query = query.filter(filter.column, filter.operator, filter.value);
      }

      if (sort) {
        query = query.order(sort.column, { ascending: sort.ascending ?? true });
      }

      const { data, error } = await query;
      if (!error && mounted) setRows(data || []);
    };

    fetchInitial();

    const subscription = supabase
      .channel(`realtime:${table}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        (payload) => {
          const applyFilter = (row: any) => {
            if (!filter) return true;
            switch (filter.operator) {
              case 'eq': return row[filter.column] === filter.value;
              case 'neq': return row[filter.column] !== filter.value;
              default: return true;
            }
          };

          setRows((prev) => {
            let updated = [...prev];
            const index = updated.findIndex((r: any) => r.id === payload.new?.id);

            if (payload.eventType === 'INSERT' && applyFilter(payload.new)) {
              return [...updated, payload.new];
            }
            if (payload.eventType === 'UPDATE' && index !== -1 && applyFilter(payload.new)) {
              updated[index] = payload.new;
              return updated;
            }
            if (payload.eventType === 'DELETE') {
              return updated.filter((r: any) => r.id !== payload.old?.id);
            }
            return updated;
          });
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(subscription);
    };
  }, [table, filter?.column, filter?.operator, filter?.value, sort?.column, sort?.ascending]);

  return rows;
}
