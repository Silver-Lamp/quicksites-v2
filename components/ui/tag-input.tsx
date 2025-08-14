'use client';

import * as React from 'react';

type Props = {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  suggestions?: string[]; // optional autocompletion list
  maxTags?: number;       // e.g., 5
  name?: string;
};

export default function TagInput({
  value, onChange, placeholder = 'Type and press Enter…',
  suggestions = [], maxTags = 5, name
}: Props) {
  const [input, setInput] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [hoverIdx, setHoverIdx] = React.useState<number>(-1);

  const normalized = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 40);
  const add = (s: string) => {
    const t = normalized(s);
    if (!t) return;
    if (value.includes(t)) return;
    if (value.length >= maxTags) return;
    onChange([...value, t]);
    setInput('');
    setOpen(false);
  };
  const remove = (t: string) => onChange(value.filter(x => x !== t));

  const filtered = React.useMemo(() => {
    const q = normalized(input);
    if (!q) return suggestions.filter(s => !value.includes(s)).slice(0, 8);
    return suggestions
      .filter(s => s.includes(q) && !value.includes(s))
      .slice(0, 8);
  }, [input, suggestions, value]);

  return (
    <div className="w-full">
      {/* Hidden input if you want to submit via forms */}
      {name && <input type="hidden" name={name} value={JSON.stringify(value)} />}
      <div className="flex flex-wrap gap-2 rounded-md border bg-background px-3 py-2">
        {value.map(tag => (
          <span key={tag} className="inline-flex items-center gap-2 rounded-full border px-2 py-1 text-xs">
            {tag}
            <button
              type="button"
              aria-label={`Remove ${tag}`}
              className="opacity-70 hover:opacity-100"
              onClick={() => remove(tag)}
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={input}
          onChange={(e) => { setInput(e.target.value); setOpen(true); setHoverIdx(-1); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)} // allow click on suggestion
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',' ) {
              e.preventDefault();
              if (hoverIdx >= 0 && filtered[hoverIdx]) add(filtered[hoverIdx]);
              else add(input);
            } else if (e.key === 'Backspace' && !input && value.length) {
              remove(value[value.length - 1]);
            } else if (e.key === 'ArrowDown') {
              e.preventDefault(); setHoverIdx((i) => Math.min(i + 1, filtered.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault(); setHoverIdx((i) => Math.max(i - 1, -1));
            }
          }}
          placeholder={value.length >= maxTags ? 'Max tags reached' : placeholder}
          disabled={value.length >= maxTags}
          className="min-w-[180px] flex-1 bg-transparent outline-none text-sm"
        />
      </div>

      {open && filtered.length > 0 && (
        <div
          className="mt-1 max-h-48 overflow-auto rounded-md border bg-popover p-1 text-sm shadow-md"
          role="listbox"
        >
          {filtered.map((s, i) => (
            <button
              key={s}
              type="button"
              role="option"
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(-1)}
              onClick={() => add(s)}
              className={[
                'w-full text-left rounded px-2 py-1',
                i === hoverIdx ? 'bg-muted' : ''
              ].join(' ')}
            >
              {s}
            </button>
          ))}
        </div>
      )}
      <p className="mt-1 text-xs text-muted-foreground">Up to {maxTags} cuisines. Press Enter or comma to add.</p>
    </div>
  );
}
