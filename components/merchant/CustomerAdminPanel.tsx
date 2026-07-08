'use client';

// Editable CRM fields on a customer profile (CRM_PLAN.md Phase 2): notes, tags,
// and marketing consent. Saves via the owner-gated PATCH route, then refreshes the
// server component so the persisted state re-renders.

import * as React from 'react';
import { useRouter } from 'next/navigation';

export default function CustomerAdminPanel({
  customerId,
  initialNotes,
  initialTags,
  initialConsent,
}: {
  customerId: string;
  initialNotes: string;
  initialTags: string[];
  initialConsent: boolean;
}) {
  const router = useRouter();
  const [notes, setNotes] = React.useState(initialNotes);
  const [tags, setTags] = React.useState<string[]>(initialTags);
  const [consent, setConsent] = React.useState(initialConsent);
  const [tagDraft, setTagDraft] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [savedAt, setSavedAt] = React.useState<number | null>(null);

  const dirty =
    notes !== initialNotes ||
    consent !== initialConsent ||
    tags.length !== initialTags.length ||
    tags.some((t, i) => t !== initialTags[i]);

  function addTag(raw: string) {
    const s = raw.trim().slice(0, 40);
    if (!s) return;
    if (tags.some((t) => t.toLowerCase() === s.toLowerCase())) { setTagDraft(''); return; }
    setTags((prev) => [...prev, s].slice(0, 40));
    setTagDraft('');
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/merchant/customers/${customerId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ notes, tags, marketingConsent: consent }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `Save failed (${res.status})`);
      setSavedAt(Date.now());
      router.refresh();
    } catch (e: any) {
      setError(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-200">Customer details</h2>
        <div className="flex items-center gap-3">
          {savedAt && !dirty && <span className="text-xs text-emerald-400">Saved</span>}
          {error && <span className="text-xs text-red-400">{error}</span>}
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
              dirty && !saving
                ? 'bg-sky-500 text-zinc-950 hover:bg-sky-400'
                : 'cursor-not-allowed bg-white/5 text-neutral-500'
            }`}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* Consent */}
      <label className="flex items-center gap-2 text-sm text-neutral-300">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="h-4 w-4 rounded border-white/20 bg-neutral-900"
        />
        Opted in to marketing
      </label>
      <p className="mt-1 text-xs text-neutral-500">Required before this customer can be included in an email/SMS campaign.</p>

      {/* Tags */}
      <div className="mt-4">
        <div className="mb-1 text-xs uppercase tracking-wide text-neutral-500">Tags</div>
        <div className="flex flex-wrap items-center gap-1.5">
          {tags.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-xs text-neutral-200">
              {t}
              <button
                type="button"
                onClick={() => setTags((prev) => prev.filter((x) => x !== t))}
                className="text-neutral-400 hover:text-white"
                aria-label={`Remove tag ${t}`}
              >
                ×
              </button>
            </span>
          ))}
          <input
            value={tagDraft}
            onChange={(e) => setTagDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(tagDraft); }
              else if (e.key === 'Backspace' && !tagDraft && tags.length) setTags((prev) => prev.slice(0, -1));
            }}
            onBlur={() => addTag(tagDraft)}
            placeholder={tags.length ? 'Add…' : 'Add a tag…'}
            className="min-w-[80px] flex-1 bg-transparent px-1 py-0.5 text-xs text-neutral-200 placeholder:text-neutral-600 focus:outline-none"
          />
        </div>
      </div>

      {/* Notes */}
      <div className="mt-4">
        <div className="mb-1 text-xs uppercase tracking-wide text-neutral-500">Notes</div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          maxLength={5000}
          placeholder="Private notes about this customer…"
          className="w-full resize-y rounded-lg bg-neutral-900 px-3 py-2 text-sm text-neutral-200 ring-1 ring-neutral-800 placeholder:text-neutral-600 focus:outline-none focus:ring-neutral-600"
        />
      </div>
    </div>
  );
}
