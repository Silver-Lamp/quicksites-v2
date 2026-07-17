'use client';

// components/byo/bring-your-domain-client.tsx
//
// "Bring your own domain" — the self-serve flow for someone already paying for a
// domain elsewhere (typically semi-parked with registrar email on it):
//   1. Enter the domain → we show where it points today + promise the two things
//      owners worry about: NO transfer, and EMAIL KEEPS WORKING (MX untouched).
//   2. Tell us what the site should be (we can't tell from a parked page) →
//      business name + site type → a real industry-starter draft is built on the
//      spot (guest session; sign up only to publish — the standard guest flow).
//   3. The exact two DNS records to change at their registrar, with copy buttons,
//      plus "open your new site" into the editor. Admins get a heads-up email so
//      the domain gets attached when the site publishes.

import * as React from 'react';
import { ensureGuestSession } from '@/lib/auth/guestSession';
import { INDUSTRIES, type IndustryKey } from '@/lib/industries';
import { buildIndustryStarter } from '@/lib/builder/industryScaffold';

type DnsRecord = { type: string; host: string; value: string; ttl: string };
type Check = {
  domain: string;
  status: 'points_here' | 'parked_elsewhere' | 'no_website_records';
  currentA: string[];
  currentWwwCname: string[];
  mx: string[];
  emailProvider: 'google' | 'microsoft' | 'other' | 'none';
  records: DnsRecord[];
};

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
const randSuffix = () => Math.random().toString(36).slice(2, 7);

/** 'grace-point-collective.com' → 'Grace Point Collective' (best-effort prefill). */
function nameFromDomain(domain: string): string {
  const label = domain.split('.')[0] || '';
  return label
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function CopyValue({ value }: { value: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {}
      }}
      className="ml-2 rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-400 hover:border-zinc-500 hover:text-white"
    >
      {copied ? '✓' : 'copy'}
    </button>
  );
}

function DnsRecordsTable({ records }: { records: DnsRecord[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/60">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-[11px] uppercase tracking-wide text-zinc-500">
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2">Host / Name</th>
            <th className="px-3 py-2">Value / Points to</th>
            <th className="px-3 py-2">TTL</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={`${r.type}-${r.host}`} className="border-b border-zinc-800/60 last:border-0">
              <td className="px-3 py-2 font-mono text-zinc-200">{r.type}</td>
              <td className="px-3 py-2 font-mono text-zinc-200">{r.host}</td>
              <td className="whitespace-nowrap px-3 py-2 font-mono text-emerald-300">
                {r.value}
                <CopyValue value={r.value} />
              </td>
              <td className="px-3 py-2 text-zinc-400">{r.ttl}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmailSafeCallout() {
  return (
    <div className="rounded-xl border border-sky-500/25 bg-sky-500/[0.06] p-4 text-sm text-zinc-300">
      <div className="font-semibold text-sky-200">Your email keeps working — promise.</div>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-zinc-400">
        <li>
          These two records only change where your <b className="text-zinc-200">website</b> points. Email lives on
          separate <span className="font-mono">MX</span> records — <b className="text-zinc-200">don't touch those</b>, and
          Google Workspace / Gmail keeps working exactly as it does today.
        </li>
        <li>
          <b className="text-zinc-200">No transfer.</b> Your domain stays at your registrar, on your account, on your
          renewal. You're just pointing it at your new site.
        </li>
        <li>
          Paying through Google? Google Domains moved to <b className="text-zinc-200">Squarespace</b> — manage DNS there
          (or via Google Admin console → Domains). Your Workspace subscription is separate and unaffected.
        </li>
      </ul>
    </div>
  );
}

/**
 * Email detection + the "drop the subscription later" explainer. Informational only —
 * this flow NEVER changes MX. The walkthrough is the customer-safe distillation of the
 * email-migration runbook (docs/EMAIL_HOSTING_PHASE0_RUNBOOK.md): what you keep, what
 * you need first, and that the whole job is two MX records — so "$X/mo for email at my
 * domain" stops feeling like a hostage situation.
 */
function EmailProviderInfo({ check }: { check: Check }) {
  const [open, setOpen] = React.useState(false);
  const p = check.emailProvider;

  const providerLine =
    p === 'google' ? (
      <>
        ✉️ We can see your email runs on <b className="text-zinc-100">Google Workspace</b>
        <span className="text-zinc-500"> ({check.mx[0]})</span>. Moving your website here doesn't touch it.
      </>
    ) : p === 'microsoft' ? (
      <>
        ✉️ We can see your email runs on <b className="text-zinc-100">Microsoft 365</b>
        <span className="text-zinc-500"> ({check.mx[0]})</span>. Moving your website here doesn't touch it.
      </>
    ) : p === 'other' ? (
      <>
        ✉️ Your domain has email service set up
        <span className="text-zinc-500"> ({check.mx[0]})</span>. Moving your website here doesn't touch it.
      </>
    ) : (
      <>✉️ No email is set up on this domain yet — nothing to protect, nothing to break.</>
    );

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 text-sm text-zinc-300">
      <div>{providerLine}</div>

      {(p === 'google' || p === 'microsoft') && (
        <div className="mt-3 border-t border-zinc-800 pt-3">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="text-sm text-zinc-400 underline underline-offset-4 hover:text-zinc-200"
          >
            {open
              ? 'Hide the email explainer'
              : `Paying ${p === 'google' ? 'for Workspace' : 'for Microsoft 365'} mostly to keep email at your domain? Here's how leaving works (when you're ready) →`}
          </button>
          {open && (
            <div className="mt-3 space-y-2 text-zinc-400">
              <p>
                Email at your own domain doesn't require a big subscription — the address itself is controlled by two
                small DNS records (called MX). If the subscription is only earning its keep as “email at my domain”,
                here's the honest shape of a move:
              </p>
              <ul className="list-disc space-y-1.5 pl-5">
                <li>
                  <b className="text-zinc-300">You keep everything that matters</b> — your domain, your addresses
                  (hello@, info@…), and your inbox habits. Your addresses can simply forward into a free Gmail (or any
                  inbox), and you can still <i>reply as</i> your domain address.
                </li>
                <li>
                  <b className="text-zinc-300">Two things first:</b> a free inbox to receive at (e.g. a personal
                  Gmail), and an export of your old mail (Google Takeout / Outlook export) — old messages don't
                  survive a cancelled subscription.
                </li>
                <li>
                  <b className="text-zinc-300">The switch itself is two MX records</b> at your registrar — the same
                  console as the website records on this page. Swap them, test for a week or two while the old
                  subscription is still active, then cancel.
                </li>
                <li>
                  <b className="text-zinc-300">This page changes none of it.</b> The website move and the email move
                  are completely independent — do the site today, email whenever (or never).
                </li>
              </ul>
              <p>
                Want a hand when the time comes? Mention it when you publish your site and we'll walk through the
                switch with you.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function BringYourDomainClient({
  initialDomain = '',
  initialRef = '',
}: {
  initialDomain?: string;
  /** Public page (Facebook etc.) handed in by the entry point — prefills step 2 and
   *  fast-tracks the parked-domain + FB combo straight to "what should the site be". */
  initialRef?: string;
}) {
  const [step, setStep] = React.useState<1 | 2 | 3>(1);
  const [domainInput, setDomainInput] = React.useState(initialDomain);
  const [check, setCheck] = React.useState<Check | null>(null);
  const [showRecordsEarly, setShowRecordsEarly] = React.useState(false);

  const [businessName, setBusinessName] = React.useState('');
  const [industry, setIndustry] = React.useState('');
  const [goal, setGoal] = React.useState('');
  const [refPages, setRefPages] = React.useState(initialRef);

  const [templateId, setTemplateId] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Entry points (homepage tab, admin chooser card) pass ?domain= — check it on arrival
  // so the visitor lands straight on their answer.
  const autoRan = React.useRef(false);
  const autoAdvanced = React.useRef(false);
  React.useEffect(() => {
    if (initialDomain && !autoRan.current) {
      autoRan.current = true;
      void runCheck();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDomain]);

  const runCheck = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!domainInput.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/public/byo-domain/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: domainInput }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || 'Could not check that domain.');
      setCheck(j.result);
      setBusinessName((prev) => prev || nameFromDomain(j.result.domain));
      // Domain + page arrived together (the combo entry) → the visitor already told
      // us where they exist online; skip straight to "what should the site be".
      if (initialRef && !autoAdvanced.current) {
        autoAdvanced.current = true;
        setStep(2);
      }
    } catch (err: any) {
      setError(err?.message || 'Could not check that domain.');
    } finally {
      setBusy(false);
    }
  };

  // Build the draft on a guest session (same auto-claim-on-signup path as the
  // homepage quick-start), stamped with the intended domain. When the owner gave us a
  // public page (Facebook, Instagram, a listing…), the AI REBUILD pipeline builds
  // from that page first — their photos, copy, and voice — and the plain industry
  // starter is only the fallback when the page can't be read.
  const [buildingFromPage, setBuildingFromPage] = React.useState(false);
  const createStarter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!check || busy) return;
    const name = businessName.trim();
    if (!name) return setError('Tell us the business or project name.');
    setBusy(true);
    setError(null);
    try {
      const sess = await ensureGuestSession();
      if (!sess.user) {
        setError(sess.error || 'Could not start a free session. You can sign in and try again.');
        return;
      }

      // Public pages the owner wants us referencing — normalized + capped.
      const referenceUrls = refPages
        .split(/[\s,]+/)
        .map((u) => u.trim())
        .filter(Boolean)
        .map((u) => (/^https?:\/\//i.test(u) ? u : `https://${u}`))
        .slice(0, 5);
      const notes = goal.trim().slice(0, 500);

      // 1) Rebuild-first: ground the draft in their first public page. Best-effort —
      //    any failure (login-walled page, scrape block) falls back to the starter.
      if (referenceUrls.length) {
        setBuildingFromPage(true);
        try {
          const res = await fetch('/api/rebuild', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url: referenceUrls[0],
              byo: {
                intendedDomain: check.domain,
                businessName: name,
                ...(notes ? { notes } : {}),
                referenceUrls,
              },
            }),
          });
          const j = await res.json().catch(() => ({}));
          if (res.ok && j?.ok && j?.id) {
            setTemplateId(j.id);
            void fetch('/api/public/byo-domain/notify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ templateId: j.id }),
            }).catch(() => {});
            setStep(3);
            return;
          }
          // fall through to the starter on any non-ok
        } catch {
          /* fall through to the starter */
        } finally {
          setBuildingFromPage(false);
        }
      }

      // 2) Industry starter (no usable page, or the rebuild couldn't read it).
      const industryKey = (industry || 'other') as IndustryKey;
      const initial: any = buildIndustryStarter({ businessName: name, industryKey });
      initial.slug = `${slugify(name) || 'site'}-${randSuffix()}`;
      initial.data = initial.data || {};
      initial.data.meta = {
        ...(initial.data.meta || {}),
        autogen_pending: true, // first editor open auto-runs copy + hero
        intended_domain: check.domain, // the whole point of this flow
        ...(notes ? { byo_notes: notes } : {}),
        ...(referenceUrls.length ? { byo_reference_urls: referenceUrls } : {}),
      };
      const res = await fetch('/api/templates/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(initial),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.id) throw new Error(j?.error || 'Could not create your site. Please try again.');
      setTemplateId(j.id);
      // Heads-up to the operators (best-effort, never blocks the flow).
      void fetch('/api/public/byo-domain/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: j.id }),
      }).catch(() => {});
      setStep(3);
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const statusLine = (c: Check) =>
    c.status === 'points_here' ? (
      <span className="text-emerald-300">
        ✓ {c.domain} already points here — once your site is published it will show at your domain.
      </span>
    ) : c.status === 'parked_elsewhere' ? (
      <span className="text-amber-300">
        {c.domain} currently points at a parked / “under construction” page
        {c.currentA.length ? ` (${c.currentA[0]})` : ''}. Perfect — two DNS records swap it for your real site.
      </span>
    ) : (
      <span className="text-zinc-300">
        {c.domain} has no website records yet — adding ours can't break anything.
      </span>
    );

  return (
    <div className="mx-auto w-full max-w-2xl text-left">
      {/* Step 1 — the domain */}
      <form onSubmit={runCheck} className="mt-8">
        <label className="text-sm font-medium text-zinc-300">Your domain</label>
        <div className="mt-2 flex gap-2">
          <input
            value={domainInput}
            onChange={(e) => setDomainInput(e.target.value)}
            placeholder="yourbusiness.com"
            autoFocus
            className="min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white placeholder-zinc-500 outline-none focus:border-zinc-500"
          />
          <button
            type="submit"
            disabled={busy || !domainInput.trim()}
            className="shrink-0 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-200 disabled:opacity-50"
          >
            {busy && !check ? 'Checking…' : 'Check it'}
          </button>
        </div>
      </form>

      {error && <div className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>}

      {check && (
        <div className="mt-4 space-y-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 text-sm">{statusLine(check)}</div>
          <EmailSafeCallout />
          <EmailProviderInfo check={check} />
          {step === 1 && (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-500"
              >
                Next: what should the site be? →
              </button>
              <button
                type="button"
                onClick={() => setShowRecordsEarly((v) => !v)}
                className="text-sm text-zinc-400 underline underline-offset-4 hover:text-zinc-200"
              >
                {showRecordsEarly ? 'Hide the DNS records' : 'Just want the DNS records?'}
              </button>
            </div>
          )}
          {step === 1 && showRecordsEarly && <DnsRecordsTable records={check.records} />}
        </div>
      )}

      {/* Step 2 — what the site should do (we can't tell from a parked page) */}
      {check && step === 2 && (
        <form onSubmit={createStarter} className="mt-6 space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
          <div>
            <label className="text-sm font-medium text-zinc-300">Business or project name</label>
            <input
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none focus:border-zinc-500"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-300">What kind of site is this?</label>
            <select
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none focus:border-zinc-500"
            >
              <option value="">Something else / not sure yet</option>
              {INDUSTRIES.map((i) => (
                <option key={i.key} value={i.key}>
                  {i.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-300">
              What should it do? <span className="text-zinc-500">(optional — helps us start you right)</span>
            </label>
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              rows={2}
              placeholder="e.g. a home for our collective — who we are, events, a way to get in touch"
              className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white placeholder-zinc-500 outline-none focus:border-zinc-500"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-300">
              Anywhere you already exist online? <span className="text-zinc-500">(optional)</span>
            </label>
            <input
              value={refPages}
              onChange={(e) => setRefPages(e.target.value)}
              placeholder="Facebook page, Instagram, Google listing, Yelp…"
              className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white placeholder-zinc-500 outline-none focus:border-zinc-500"
            />
            <p className="mt-1 text-xs text-zinc-500">
              Give us a page and we'll build your first draft FROM it — your photos, copy, and voice, not generic
              filler. Separate several with commas; the first one is what we build from.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {busy
                ? buildingFromPage
                  ? 'Building from your page… (~20s)'
                  : 'Building your starter site…'
                : refPages.trim()
                  ? '✨ Build my site from my page'
                  : 'Build my starter site'}
            </button>
            <button type="button" onClick={() => setStep(1)} className="text-sm text-zinc-400 hover:text-zinc-200">
              ← Back
            </button>
          </div>
          <p className="text-xs text-zinc-500">
            Free to build and edit — you sign up only when you're ready to publish. No credit card.
          </p>
        </form>
      )}

      {/* Step 3 — the two records + into the editor */}
      {check && step === 3 && templateId && (
        <div className="mt-6 space-y-4">
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] p-5">
            <div className="text-lg font-semibold text-emerald-200">🎉 Your starter site is ready.</div>
            <p className="mt-1 text-sm text-zinc-300">
              Two things left, in either order: point <b className="text-white">{check.domain}</b> at it, and make the
              site yours in the editor.
            </p>
          </div>

          <div>
            <div className="mb-2 text-sm font-semibold text-zinc-200">
              1. At your registrar, set these two records (leave everything else — especially MX — alone):
            </div>
            <DnsRecordsTable records={check.records} />
            <p className="mt-2 text-xs text-zinc-500">
              DNS changes usually take minutes, occasionally a few hours. Your domain will show your new site once it's
              published and we've attached it — we've been notified and will connect {check.domain} when you publish.
            </p>
          </div>

          <div>
            <div className="mb-2 text-sm font-semibold text-zinc-200">2. Make the site yours:</div>
            <button
              type="button"
              onClick={() => window.location.assign(`/admin/templates/${templateId}`)}
              className="rounded-xl bg-white px-6 py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-200"
            >
              Open my new site in the editor →
            </button>
            <p className="mt-2 text-xs text-zinc-500">
              Edit everything live. Sign up when you're ready to publish — your draft comes with you.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
