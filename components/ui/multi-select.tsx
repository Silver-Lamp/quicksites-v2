'use client';

import * as React from 'react';
import { cn } from '@/admin/lib/utils';

type StringOption = string;
type ObjectOption = { value: string; label?: string };
type MultiSelectOption = StringOption | ObjectOption;

export type MultiSelectProps = {
  /** Accepts ['A','B'] or [{value:'A',label:'A'}] */
  options: MultiSelectOption[];

  /** Preferred controlled value prop */
  value?: string[];
  /** Back-compat alias (if both provided, `value` wins) */
  selected?: string[];

  onChange: (v: string[]) => void;

  placeholder?: string;
  /** Optional label above control */
  label?: React.ReactNode;
  /** Small helper text under control */
  helperText?: React.ReactNode;
  /** Error text (styles as invalid) */
  error?: React.ReactNode;

  disabled?: boolean;
  className?: string;            // outer container
  inputClassName?: string;       // search input
  listClassName?: string;        // list area
  labelClassName?: string;       // label styling
};

function normalizeOptions(options: MultiSelectOption[]) {
  return options.map((o) =>
    typeof o === 'string'
      ? { value: o, label: o }
      : { value: o.value, label: o.label ?? o.value }
  );
}

export function MultiSelect({
  options,
  value,
  selected,
  onChange,
  placeholder = 'Search…',
  label,
  helperText,
  error,
  disabled,
  className,
  inputClassName,
  listClassName,
  labelClassName,
}: MultiSelectProps) {
  const [query, setQuery] = React.useState('');
  const all = React.useMemo(() => normalizeOptions(options), [options]);

  const current = value ?? selected ?? [];
  const set = (vals: string[]) => onChange(Array.from(new Set(vals)));

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (o) =>
        o.value.toLowerCase().includes(q) ||
        (o.label ?? '').toLowerCase().includes(q)
    );
  }, [all, query]);

  function toggle(code: string) {
    set(current.includes(code) ? current.filter((c) => c !== code) : [...current, code]);
  }

  const allSelected = filtered.length > 0 && filtered.every((o) => current.includes(o.value));

  return (
    <div className={cn('grid gap-1', className)} aria-disabled={disabled}>
      {label != null && (
        <label className={cn('text-sm font-medium leading-none', labelClassName)}>
          {label}
        </label>
      )}

      <div
        className={cn(
          'rounded border',
          error ? 'border-red-500' : 'border-neutral-300 dark:border-neutral-800',
          disabled && 'opacity-60 pointer-events-none'
        )}
      >
        <div className={cn(
          'flex items-center gap-2 border-b px-2 py-2',
          error ? 'border-red-500/60' : 'border-neutral-300 dark:border-neutral-800'
        )}>
          <input
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={cn(
              'w-full rounded bg-transparent px-3 py-2 text-sm outline-none',
              'text-black dark:text-white placeholder:text-neutral-500',
              inputClassName
            )}
          />
          {current.length > 0 && (
            <button
              type="button"
              onClick={() => set([])}
              className="rounded bg-neutral-100 dark:bg-neutral-900 px-2 py-1 text-xs ring-1 ring-neutral-300 dark:ring-neutral-800"
            >
              clear
            </button>
          )}
          {filtered.length > 1 && (
            <button
              type="button"
              onClick={() =>
                set(allSelected ? current.filter((c) => !filtered.some((f) => f.value === c))
                                : Array.from(new Set([...current, ...filtered.map((f) => f.value)])))
              }
              className="rounded bg-neutral-100 dark:bg-neutral-900 px-2 py-1 text-xs ring-1 ring-neutral-300 dark:ring-neutral-800"
            >
              {allSelected ? 'unselect all' : 'select all'}
            </button>
          )}
        </div>

        <div className={cn('max-h-48 overflow-auto', listClassName)} role="listbox" aria-multiselectable>
          {filtered.map((opt) => (
            <label
              key={opt.value}
              className="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-900"
            >
              <input
                type="checkbox"
                checked={current.includes(opt.value)}
                onChange={() => toggle(opt.value)}
                className="accent-purple-600"
              />
              <span className="text-sm">
                {opt.label ?? opt.value}
              </span>
              {opt.label && opt.label !== opt.value && (
                <span className="ml-2 font-mono text-[11px] text-neutral-500">{opt.value}</span>
              )}
            </label>
          ))}
          {filtered.length === 0 && (
            <div className="px-3 py-2 text-xs text-neutral-500">No matches</div>
          )}
        </div>
      </div>

      {(error || helperText) && (
        <p className={cn('text-xs mt-1', error ? 'text-red-600' : 'text-muted-foreground')}>
          {error ?? helperText}
        </p>
      )}
    </div>
  );
}
