// ✅ FILE: /components/admin/SettingsSchema.tsx

'use client';

import { useState } from 'react';

export function SettingsSchema({
  schema,
  values,
  onChange,
}: {
  schema: Record<string, any>;
  values: Record<string, any>;
  onChange: (key: string, value: any) => void;
}) {
  const grouped = Object.entries(schema).reduce((acc, [key, config]) => {
    const group = config.group || 'Default';
    acc[group] = acc[group] || [];
    acc[group].push([key, config]);
    return acc;
  }, {} as Record<string, [string, any][]>);

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    Object.fromEntries(Object.keys(grouped).map((g) => [g, true]))
  );

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([group, entries]) => (
        <div key={group} className="border rounded-md overflow-hidden">
          <button
            type="button"
            onClick={() => setExpandedGroups((prev) => ({ ...prev, [group]: !prev[group] }))}
            className="w-full px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-left font-semibold text-sm hover:bg-zinc-200 dark:hover:bg-zinc-700"
          >
            {expandedGroups[group] ? '▾' : '▸'} {group}
          </button>

          {expandedGroups[group] && (
            <div className="p-4 space-y-6">
              {entries.map(([key, config]) => {
                const label = config.label || key;
                const value = values[key] ?? config.default;
                const description = config.description;

                const isOutOfBounds =
                  config.type === 'number' &&
                  ((typeof config.min === 'number' && value < config.min) ||
                    (typeof config.max === 'number' && value > config.max));

                const inputClass = `mt-1 block w-full px-2 py-1 border rounded bg-white dark:bg-zinc-800 ${
                  isOutOfBounds ? 'border-red-500' : 'border-gray-300'
                }`;

                const renderInput = () => {
                  switch (config.type) {
                    case 'text':
                      return (
                        <input
                          type="text"
                          className={inputClass}
                          value={value}
                          onChange={(e) => onChange(key, e.target.value)}
                        />
                      );
                    case 'number':
                      return (
                        <>
                          <input
                            type="number"
                            className={inputClass}
                            value={value}
                            min={config.min}
                            max={config.max}
                            step={config.step || 1}
                            onChange={(e) => onChange(key, Number(e.target.value))}
                          />
                          {isOutOfBounds && (
                            <div className="text-xs text-red-500 mt-1">
                              Value should be between {config.min} and {config.max}
                            </div>
                          )}
                        </>
                      );
                    case 'boolean':
                      return (
                        <div className="flex items-center gap-2 mt-1">
                          <input
                            type="checkbox"
                            checked={value}
                            onChange={(e) => onChange(key, e.target.checked)}
                          />
                          <span className="text-sm">{label}</span>
                        </div>
                      );
                    case 'select':
                      return (
                        <select
                          className={inputClass}
                          value={value}
                          onChange={(e) => onChange(key, e.target.value)}
                        >
                          {config.options?.map((opt: string) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      );
                    default:
                      return (
                        <div className="text-red-500 text-xs">
                          Unknown input type for <code>{key}</code>
                        </div>
                      );
                  }
                };

                return (
                  <div key={key} className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="block text-sm font-medium group relative cursor-help">
                        {label}
                        {description && (
                          <div className="absolute z-10 left-0 top-full mt-1 w-max max-w-xs bg-zinc-800 text-white text-xs rounded px-2 py-1 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
                            {description}
                          </div>
                        )}
                      </label>
                      <button
                        type="button"
                        onClick={() => onChange(key, config.default)}
                        className="text-xs text-blue-500 hover:underline"
                      >
                        Reset
                      </button>
                    </div>
                    {renderInput()}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
