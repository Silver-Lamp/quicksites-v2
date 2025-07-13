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

  return (
    <div className={cn('mb-4', props.className)}>
      {props.label && (
        <label htmlFor={id} className="block text-sm font-medium text-white mb-1">
          {props.label}
        </label>
      )}

      {props.type === 'text' && (
        <input
          id={id}
          type="text"
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          placeholder={props.placeholder}
          className="w-full px-3 py-1.5 bg-gray-800 border border-gray-600 rounded text-white"
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
          className="w-full px-3 py-1.5 bg-gray-800 border border-gray-600 rounded text-white"
        />
      )}

      {props.type === 'select' && (
        <select
          id={id}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          className="w-full px-3 py-1.5 bg-gray-800 border border-gray-600 rounded text-white"
        >
          {props.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      )}

      {props.type === 'boolean' && (
        <label className="flex items-center gap-2 text-sm text-white">
          <input
            id={id}
            type="checkbox"
            checked={props.value}
            onChange={(e) => props.onChange(e.target.checked)}
            className="w-4 h-4"
          />
          {props.label}
        </label>
      )}

      {props.description && (
        <p className="text-xs text-gray-400 mt-1">{props.description}</p>
      )}

      {props.error && (
        <p className="text-xs text-red-400 mt-1">{props.error}</p>
      )}
    </div>
  );
}
