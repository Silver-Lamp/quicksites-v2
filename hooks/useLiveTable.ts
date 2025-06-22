import { useEffect, useState } from 'react';
import { supabase } from '../admin/lib/supabaseClient';

type Filter = { column: keyof any; operator: 'eq' | 'neq'; value: any };
type Sort = { column: keyof any; ascending?: boolean };

export function useLiveTable<T extends { id: string | number }>(
  table: string,
  filter?: Filter,
  sort?: Sort
): T[] {
  const [rows, setRows] = useState<T[]>([]);

  useEffect(() => {
    let mounted = true;

    const fetchInitial = async () => {
      let query = supabase.from(table).select('*');

      if (filter) {
        query = query.filter(filter.column as string, filter.operator, filter.value);
      }

      if (sort) {
        query = query.order(sort.column as string, {
          ascending: sort.ascending ?? true,
        });
      }

      const { data, error } = await query;
      if (!error && mounted) setRows((data as T[]) || []);
    };

    fetchInitial();

    const subscription = supabase
      .channel(`realtime:${table}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
        const applyFilter = (row: T) => {
          if (!filter) return true;
          switch (filter.operator) {
            case 'eq':
              return row[filter.column as keyof T] === filter.value;
            case 'neq':
              return row[filter.column as keyof T] !== filter.value;
            default:
              return true;
          }
        };

        setRows((prev) => {
          const updated = [...prev];
          const index = updated.findIndex((r) => r.id === (payload.new as T)?.id);

          switch (payload.eventType) {
            case 'INSERT':
              return applyFilter(payload.new as T) ? [...updated, payload.new as T] : updated;
            case 'UPDATE':
              if (index !== -1 && applyFilter(payload.new as T)) {
                updated[index] = payload.new as T;
              }
              return updated;
            case 'DELETE':
              return updated.filter((r) => r.id !== (payload.old as T)?.id);
            default:
              return updated;
          }
        });
      })
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(subscription);
    };
  }, [table, filter?.column, filter?.operator, filter?.value, sort?.column, sort?.ascending]);

  return rows;
}
