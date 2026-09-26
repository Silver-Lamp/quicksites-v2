'use client';

// components/admin/templates/industry-picker.tsx
//
// A searchable industry picker, replacing a raw <select> over ~60 options.
//
// ⚠️ THE OLD CONTROL ASKED A QUESTION IT COULD HAVE ANSWERED. It sat directly under a business
// name the person had already typed — "Joe's Ship Repair" — and made them scroll an alphabetical
// list to find their own trade. This types ahead, matches words that appear in no label at all
// ("AC", "wrecker", "power wash", "exterminator"), and offers a guess from the name.
//
// ⚠️ THE GUESS IS OFFERED, NEVER APPLIED. It appears as a suggestion chip the person clicks. An
// industry chosen silently shapes the entire scaffold — services, theme, copy — so a confident
// wrong guess costs far more than no guess, and `suggestFromBusinessName` returns nothing rather
// than the nearest thing when a name has no trade in it.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Sparkles, X } from 'lucide-react';
import { INDUSTRIES } from '@/lib/industries';
import { searchIndustries, suggestFromBusinessName } from '@/lib/industries/search';

export default function IndustryPicker({
  value,
  onChange,
  businessName,
  onChooseOther,
  className = '',
}: {
  /** Current industry key, or '' for none. */
  value: string;
  onChange: (key: string) => void;
  /** Used only to offer a suggestion; never written anywhere. */
  businessName?: string | null;
  /** Called when "Other" is picked, so the caller can focus its free-text field. */
  onChooseOther?: () => void;
  className?: string;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  const selectedLabel = useMemo(
    () => INDUSTRIES.find((i) => i.key === value)?.label ?? '',
    [value],
  );

  const suggestion = useMemo(
    () => (businessName ? suggestFromBusinessName(businessName) : null),
    [businessName],
  );

  // With no query, show a short alphabetical slice rather than nothing — an empty dropdown reads
  // as broken, and browsing is still legitimate for someone who does not know what to call it.
  const results = useMemo(() => {
    // ⚠️ `other` is filtered out of the matches because it gets a PERMANENT row below. Left in
    // the list it sorts alphabetically between "Moving" and "Painting", which is exactly where
    // nobody looks for "my trade isn't here".
    const drop = (m: { key: string }) => m.key !== 'other';
    if (query.trim()) return searchIndustries(query, 10).filter(drop);
    return [...INDUSTRIES]
      .filter(drop)
      .sort((a, b) => a.label.localeCompare(b.label))
      .slice(0, 10)
      .map((i) => ({ key: i.key, label: i.label, score: 0, via: i.label }));
  }, [query]);

  useEffect(() => setActive(0), [query]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const pick = (key: string) => {
    onChange(key);
    setQuery('');
    setOpen(false);
  };

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      <div className="flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900/70 px-2.5 py-2 focus-within:border-sky-500">
        <Search className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
        <input
          value={open ? query : selectedLabel || query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, results.length - 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
            else if (e.key === 'Enter' && open && results[active]) { e.preventDefault(); pick(results[active].key); }
            else if (e.key === 'Escape') { setOpen(false); }
          }}
          placeholder={selectedLabel ? '' : 'Search — e.g. plumber, AC, tow truck'}
          aria-label="Industry"
          className="w-full bg-transparent text-sm text-white placeholder:text-zinc-500 focus:outline-none"
        />
        {value && (
          <button
            type="button"
            onClick={() => { onChange(''); setQuery(''); }}
            aria-label="Clear industry"
            className="shrink-0 rounded p-0.5 text-zinc-500 transition hover:text-zinc-200"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* ⚠️ A CHIP, NOT A DEFAULT. Shown only for a `strong` read of the business name, and it
          still takes a click. "because you wrote …" is there so a surprising guess explains
          itself rather than looking like magic that got it wrong. */}
      {!value && suggestion?.match && suggestion.confidence === 'strong' && (
        <button
          type="button"
          onClick={() => pick(suggestion.match!.key)}
          className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-sky-500/40 bg-sky-500/10 px-3 py-1 text-xs text-sky-200 transition hover:bg-sky-500/20"
        >
          <Sparkles className="h-3 w-3" aria-hidden />
          {suggestion.match.label}
          <span className="text-sky-400/80">— because you wrote “{suggestion.because}”</span>
        </button>
      )}

      {open && (
        <ul
          role="listbox"
          className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-zinc-700 bg-zinc-950 py-1 shadow-xl"
        >
          {results.length === 0 ? (
            // ⚠️ Says what to do next instead of going blank. The free-text "Other" field beside
            // this exists precisely for trades we do not list, and a dead dropdown hides that.
            <li className="px-3 py-2 text-xs text-zinc-400">
              Nothing matches “{query}”. Pick{' '}
              <span className="text-zinc-200">Other</span> below and describe it in your own words.
            </li>
          ) : (
            results.map((r, i) => (
              <li key={r.key}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(r.key)}
                  className={`flex w-full items-baseline justify-between gap-3 px-3 py-1.5 text-left text-sm transition ${
                    i === active ? 'bg-zinc-800 text-white' : 'text-zinc-300 hover:bg-zinc-900'
                  }`}
                >
                  <span>{r.label}</span>
                  {/* Why this appeared, when the reason is not the label itself. */}
                  {r.via && r.via.toLowerCase() !== r.label.toLowerCase() && (
                    <span className="shrink-0 text-[11px] text-zinc-500">{r.via}</span>
                  )}
                </button>
              </li>
            ))
          )}

          {/* ⚠️ ALWAYS PRESENT, NOT A SEARCH RESULT. "My trade isn't here" is the one option a
              person cannot search for — they do not know what we call it, which is why they are
              stuck. Buried alphabetically between "Moving" and "Painting" it was invisible, and
              the free-text box beside the picker was DISABLED until you found it. Selecting this
              enables that box and focuses it. */}
          <li className="border-t border-zinc-800">
            <button
              type="button"
              role="option"
              aria-selected={value === 'other'}
              onClick={() => {
                pick('other');
                onChooseOther?.();
              }}
              className="flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left text-sm text-zinc-300 transition hover:bg-zinc-900"
            >
              <span>Other — not in the list</span>
              <span className="shrink-0 text-[11px] text-zinc-500">describe it yourself</span>
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
