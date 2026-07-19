'use client';

// Design-partner CRM — cards for each contact: identity/context (from code) + their /for-<name>
// page + editable pipeline (status, next step + due, notes) + a nudge stamp. The foundation for
// forward-progress tracking; nudge reminders build on lastNudgedAt.

import * as React from 'react';

type Partner = {
  id: string;
  name: string;
  forPage: string;
  role: string;
  company?: string;
  blurb: string;
  email?: string;
  phone?: string;
  referralCode?: string;
  status: string;
  nextStep?: string;
  nextStepDue?: string;
  notes?: string;
  lastNudgedAt?: string;
};

const STATUSES = ['prospect', 'contacted', 'engaged', 'active', 'paused'];
const STATUS_TONE: Record<string, string> = {
  prospect: 'border-zinc-600 bg-zinc-700/40 text-zinc-300',
  contacted: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
  engaged: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  active: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  paused: 'border-zinc-600 bg-zinc-800 text-zinc-500',
};

const daysAgo = (iso?: string) => {
  if (!iso) return null;
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return d <= 0 ? 'today' : `${d}d ago`;
};

export default function DesignPartnersClient() {
  const [partners, setPartners] = React.useState<Partner[]>([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/design-partners', { cache: 'no-store' });
      const j = await r.json();
      if (r.ok) setPartners(j.partners as Partner[]);
    } finally {
      setLoading(false);
    }
  }, []);
  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 text-neutral-200">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-white">🤝 Design Partners</h1>
        <p className="mt-1 text-sm text-neutral-400">
          The people you’re recruiting to use, pilot, and spread QuickSites — each with a warm
          /for-&lt;name&gt; page. Track next steps + nudge forward. (HiveJournal has a sibling
          page.)
        </p>
      </header>

      {loading ? (
        <p className="text-sm text-neutral-500">Loading…</p>
      ) : (
        <ul className="space-y-4">
          {partners.map((p) => (
            <PartnerCard key={p.id} p={p} onSaved={load} />
          ))}
        </ul>
      )}
    </div>
  );
}

function PartnerCard({ p, onSaved }: { p: Partner; onSaved: () => void }) {
  const [status, setStatus] = React.useState(p.status);
  const [nextStep, setNextStep] = React.useState(p.nextStep ?? '');
  const [due, setDue] = React.useState(p.nextStepDue ?? '');
  const [notes, setNotes] = React.useState(p.notes ?? '');
  const [email, setEmail] = React.useState(p.email ?? '');
  const [phone, setPhone] = React.useState(p.phone ?? '');
  const [referralCode, setReferralCode] = React.useState(p.referralCode ?? '');
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  const dirty =
    status !== p.status ||
    nextStep !== (p.nextStep ?? '') ||
    due !== (p.nextStepDue ?? '') ||
    notes !== (p.notes ?? '') ||
    email !== (p.email ?? '') ||
    phone !== (p.phone ?? '') ||
    referralCode !== (p.referralCode ?? '');

  const patch = async (body: any) => {
    setSaving(true);
    try {
      const r = await fetch(`/api/admin/design-partners/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (r.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
        onSaved();
      }
    } finally {
      setSaving(false);
    }
  };
  const save = () => patch({ status, nextStep, nextStepDue: due, notes, email, phone, referralCode });
  const nudge = () => patch({ action: 'nudge' });

  return (
    <li className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white">{p.name}</h2>
            <span className="text-xs text-neutral-400">
              {p.role}
              {p.company ? ` · ${p.company}` : ''}
            </span>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-neutral-400">{p.blurb}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
            <a
              href={p.forPage}
              target="_blank"
              rel="noreferrer"
              className="rounded border border-neutral-700 px-2 py-1 text-sky-400 hover:bg-neutral-800"
            >
              {p.forPage} ↗
            </a>
            {p.referralCode && (
              <span className="text-neutral-500">
                code <code className="text-emerald-300">{p.referralCode}</code>
              </span>
            )}
            {p.email && (
              <a href={`mailto:${p.email}`} className="text-neutral-400 hover:underline">
                {p.email}
              </a>
            )}
            {p.phone && <span className="text-neutral-500">{p.phone}</span>}
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-medium capitalize ${STATUS_TONE[status] ?? STATUS_TONE.prospect}`}
        >
          {status}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="text-xs">
          <span className="text-neutral-500">Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-sm capitalize text-white"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs sm:col-span-2">
          <span className="text-neutral-500">Next step</span>
          <input
            value={nextStep}
            onChange={(e) => setNextStep(e.target.value)}
            placeholder="What moves this forward?"
            className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-sm text-white"
          />
        </label>
        <label className="text-xs">
          <span className="text-neutral-500">Due</span>
          <input
            type="date"
            value={due ? due.slice(0, 10) : ''}
            onChange={(e) => setDue(e.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-sm text-white"
          />
        </label>
        <label className="text-xs sm:col-span-2">
          <span className="text-neutral-500">Notes</span>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Context, last conversation…"
            className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-sm text-white"
          />
        </label>

        {/* Contact — owner-entered, stored in site_settings (never hardcoded in the repo). */}
        <label className="text-xs">
          <span className="text-neutral-500">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-sm text-white"
          />
        </label>
        <label className="text-xs">
          <span className="text-neutral-500">Phone</span>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(555) 123-4567"
            className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-sm text-white"
          />
        </label>
        <label className="text-xs">
          <span className="text-neutral-500">Referral code</span>
          <input
            value={referralCode}
            onChange={(e) => setReferralCode(e.target.value)}
            placeholder="e.g. daniel"
            className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-sm text-white"
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving || !dirty}
          className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={nudge}
          disabled={saving}
          className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800"
        >
          👋 Mark nudged
        </button>
        {saved && <span className="text-xs text-emerald-400">Saved ✓</span>}
        <span className="ml-auto text-[11px] text-neutral-500">
          {p.lastNudgedAt ? `Last nudged ${daysAgo(p.lastNudgedAt)}` : 'Not nudged yet'}
        </span>
      </div>
    </li>
  );
}
