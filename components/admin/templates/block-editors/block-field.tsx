'use client';

import { useId } from 'react';
import { cn } from '@/admin/lib/utils';
import type { BlockValidationError } from '@/hooks/validateTemplateBlocks';

type FieldBaseProps = {
  label?: string;
  description?: string;
  className?: string;
  error?: string | BlockValidationError[];
};

type BlockFieldProps =
  | (FieldBaseProps & {
      type: 'text';
      value: string | number;
      onChange: (v: string) => void;
      placeholder?: string;
    })
  | (FieldBaseProps & {
      type: 'number';
      value: string | number;
      onChange: (v: number) => void;
      min?: number;
      max?: number;
      step?: number;
    })
  | (FieldBaseProps & {
      type: 'select';
      value: string | number;
      onChange: (v: string) => void;
      options: string[];
    })
  | (FieldBaseProps & {
      type: 'boolean';
      value: string | number;
      onChange: (v: boolean) => void;
    });

export default function BlockField(props: BlockFieldProps) {
  const id = useId();

  const hasErrors = Array.isArray(props.error)
    ? props.error.length > 0
    : Boolean(props.error);

  const baseInputClass =
    'w-full px-3 py-1.5 rounded text-white bg-gray-800 border focus:outline-none focus:ring-2 focus:ring-purple-500';

  const errorInputClass = 'border-red-500 focus:ring-red-500';

  return (
    <div className={cn('mb-4', props.className)}>
      {/* ✅ Label */}
      {props.label && props.type !== 'boolean' && (
        <label
          htmlFor={id}
          className="block text-sm font-medium text-white mb-1"
        >
          {props.label}
        </label>
      )}

      {/* ✅ Input types */}
      {props.type === 'text' && (
        <input
          id={id}
          type="text"
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          placeholder={props.placeholder}
          className={cn(baseInputClass, hasErrors && errorInputClass)}
        />
      )}

      {props.type === 'number' && (
        <input
          id={id}
          type="number"
          value={props.value}
          onChange={(e) => props.onChange(Number(e.target.value))}
          min={props.min}
          max={props.max}
          step={props.step}
          className={cn(baseInputClass, hasErrors && errorInputClass)}
        />
      )}

      {props.type === 'select' && (
        <select
          id={id}
          value={props.value as string}
          onChange={(e) => props.onChange(e.target.value)}
          className={cn(baseInputClass, hasErrors && errorInputClass)}
        >
          {props.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      )}

      {props.type === 'boolean' && (
        <div className="flex items-center gap-2">
          <input
            id={id}
            type="checkbox"
            checked={props.value as unknown as boolean}
            onChange={(e) => props.onChange(e.target.checked)}
            className="w-4 h-4"
          />
          <label htmlFor={id} className="text-sm text-white">
            {props.label}
          </label>
        </div>
      )}

      {/* ✅ Description */}
      {props.description && (
        <p className="text-xs text-gray-400 mt-1">{props.description}</p>
      )}

      {/* ✅ Errors */}
      {hasErrors && (
        <div className="mt-1 space-y-1">
          {Array.isArray(props.error) ? (
            props.error.map((err, i) => (
              <div
                key={i}
                className="text-xs text-red-400 flex flex-wrap items-center gap-2"
              >
                <span>{err.message}</span>
                {err.field && <code className="text-white">{err.field}</code>}
                {err.code && (
                  <span className="px-1 py-0.5 rounded bg-red-900/40 border border-red-700/50 text-red-200 text-[10px]">
                    {err.code}
                  </span>
                )}
              </div>
            ))
          ) : (
            <p className="text-xs text-red-400">{props.error}</p>
          )}
        </div>
      )}
    </div>
  );
}
