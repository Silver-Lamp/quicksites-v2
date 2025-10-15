// components/admin/candidate/BlocksEditor.tsx
'use client';

import * as React from 'react';

type Flags = {
  is_paid?: boolean;
  allow_text?: boolean;
  allow_email?: boolean;
  enable_donations?: boolean;
  enable_events?: boolean;
  enable_newsletter?: boolean;
  enable_endorsements?: boolean;
  enable_volunteer?: boolean;
};

export default function BlocksEditor({
  slug,
  initialBlocksJson,
  initialFlags,
}: {
  slug: string;
  /** pretty-printed JSON string representing either an array of blocks or { blocks: [...] } */
  initialBlocksJson: string;
  initialFlags: Flags;
}) {
  const [text, setText] = React.useState(initialBlocksJson);
  const [flags, setFlags] = React.useState<Flags>(initialFlags);
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState<string | null>(null);

  function format() {
    try {
      const v = JSON.parse(text);
      setText(JSON.stringify(v, null, 2));
      setErr(null);
    } catch (e: any) {
      setErr(e?.message ?? 'Invalid JSON');
    }
  }

  async function save() {
    setSaving(true);
    setErr(null);
    setOk(null);
    try {
      let bodyBlocks: any;
      try {
        bodyBlocks = JSON.parse(text);
      } catch (e: any) {
        setErr(`JSON parse error: ${e?.message ?? 'Invalid JSON'}`);
        setSaving(false);
        return;
      }

      const res = await fetch('/api/admin/candidate/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, blocks: bodyBlocks, flags }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(j?.error ?? `Save failed (${res.status})`);
      } else {
        setOk('Saved!');
      }
    } finally {
      setSaving(false);
    }
  }

  const gateFields: Array<keyof Flags> = [
    'is_paid',
    'enable_donations',
    'enable_events',
    'enable_newsletter',
    'enable_endorsements',
    'enable_volunteer',
    'allow_text',
    'allow_email',
  ];

  return (
    <div className="grid gap-6 md:grid-cols-5">
      {/* JSON editor */}
      <div className="md:col-span-3">
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="flex items-center justify-between bg-gray-50 px-3 py-2 text-xs dark:bg-gray-800/60">
            <span className="font-medium">Blocks JSON</span>
            <div className="flex gap-2">
              <button onClick={format} className="rounded border border-gray-300 px-2 py-1 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800">Format</button>
              <button onClick={save} disabled={saving} className="rounded bg-indigo-600 px-3 py-1.5 font-semibold text-white disabled:opacity-60">Save</button>
            </div>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            className="h-[520px] w-full resize-none bg-white p-3 font-mono text-xs leading-5 text-gray-900 outline-none dark:bg-gray-900 dark:text-gray-100"
          />
        </div>

        {err && <div className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{err}</div>}
        {ok && <div className="mt-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">{ok}</div>}
      </div>

      {/* Flags */}
      <div className="md:col-span-2">
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-3">
          <div className="mb-2 text-sm font-medium">Plan & Gates</div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {gateFields.map((k) => (
              <label key={k} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!flags[k]}
                  onChange={(e) => setFlags((f) => ({ ...f, [k]: e.target.checked }))}
                />
                <span className="capitalize">{k.replace(/_/g, ' ')}</span>
              </label>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-gray-500 dark:text-gray-400">
            Tip: If <strong>is paid</strong> is checked but some features still appear locked publicly,
            the public page will still force-unlock all entitlements for a paid page.
          </p>
        </div>
      </div>
    </div>
  );
}
