'use client';

import { useId } from 'react';
import { cn } from '@/admin/lib/utils';

type FieldBaseProps = {
  label?: string;
  description?: string;
  className?: string;
  error?: string;
};

type BlockFieldProps =
  | (FieldBaseProps & {
      type: 'text';
      value: string;
      onChange: (v: string) => void;
      placeholder?: string;
    })
  | (FieldBaseProps & {
      type: 'number';
      value: number;
      onChange: (v: number) => void;
      min?: number;
      max?: number;
      step?: number;
    })
  | (FieldBaseProps & {
      type: 'select';
      value: string;
      onChange: (v: string) => void;
      options: string[];
    })
  | (FieldBaseProps & {
      type: 'boolean';
      value: boolean;
      onChange: (v: boolean) => void;
    });

export default function BlockField(props: BlockFieldProps) {
  const id = useId();

  const baseInputClass =
    'w-full px-3 py-1.5 bg-gray-800 border border-gray-600 rounded text-white';

  return (
    <div className={cn('mb-4', props.className)}>
      {/* ✅ Label */}
      {props.label && props.type !== 'boolean' && (
        <label htmlFor={id} className="block text-sm font-medium text-white mb-1">
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
          className={baseInputClass}
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
          className={baseInputClass}
        />
      )}

      {props.type === 'select' && (
        <select
          id={id}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          className={baseInputClass}
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
            checked={props.value}
            onChange={(e) => props.onChange(e.target.checked)}
            className="w-4 h-4"
          />
          <label htmlFor={id} className="text-sm text-white">
            {props.label}
          </label>
        </div>
      )}

      {/* ✅ Optional helpers */}
      {props.description && (
        <p className="text-xs text-gray-400 mt-1">{props.description}</p>
      )}
      {props.error && (
        <p className="text-xs text-red-400 mt-1">{props.error}</p>
      )}
    </div>
  );
}
