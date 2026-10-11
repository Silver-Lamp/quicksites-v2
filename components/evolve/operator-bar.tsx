'use client';

// components/evolve/operator-bar.tsx
//
// The operator's strip at the top of an Evolve page, shown only to a signed-in member (owner,
// 2026-10-11: "if I'm logged in, buttons where I can copy a DM post for FB and text this to the
// business"). A visitor — the restaurant owner the page is for — never sees it. Drafts come
// from lib/rep/repBuild.ts (held to the forbidden list by test); the admin-only links (claim
// link, postcard) are passed in by the server page, which minted them only for an admin.
import * as React from 'react';
import { CurrentUserContext } from '@/components/admin/context/current-user-provider';
import { repOrderingDmDraft, repOrderingSmsDraft, smsHref } from '@/lib/rep/repBuild';

export type OperatorBarProps = {
  businessName: string;
  phone: string | null;
  evolveUrl: string;
  previewUrl: string | null;
  /** Admin-only extras, null for a member who is not an admin. */
  admin: { claimUrl: string | null; cardFrontUrl: string | null; cardBackUrl: string | null; senderName: string } | null;
};

const pill = 'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium';

export default function OperatorBar(p: OperatorBarProps) {
  const { user, ready } = React.useContext(CurrentUserContext);
  const [note, setNote] = React.useState('');
  const member = ready && !!user && !(user as { is_anonymous?: boolean | null }).is_anonymous;
  if (!member) return null;
  const repName = p.admin?.senderName || (user?.user_metadata?.full_name as string | undefined)?.split(' ')[0] || (user?.email ?? '').split('@')[0].split('+')[0] || 'a QuickSites rep';
  const dm = repOrderingDmDraft({ repName, businessName: p.businessName, evolveUrl: p.evolveUrl });
  const sms = repOrderingSmsDraft({ repName, businessName: p.businessName, previewUrl: p.previewUrl ?? p.evolveUrl, evolveUrl: p.evolveUrl });
  const copy = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setNote(`${label} copied.`);
    } catch {
      window.prompt(label, text);
    }
    setTimeout(() => setNote(''), 2000);
  };
  return (
    <div className="mx-auto max-w-6xl px-6 pt-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-300">You, not them</span>
        <button type="button" onClick={() => copy('DM', dm)} className={`${pill} border-sky-500/40 bg-sky-500/10 text-sky-200 hover:bg-sky-500/20`}>
          Copy DM for Facebook
        </button>
        {p.phone ? (
          <a href={smsHref(p.phone, sms)} className={`${pill} border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20`}>
            Text this to {p.businessName}
          </a>
        ) : (
          <button type="button" onClick={() => copy('Text', sms)} className={`${pill} border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20`} title="No phone on the prospect — copies the text instead">
            Copy the text
          </button>
        )}
        <button type="button" onClick={() => copy('Evolve link', p.evolveUrl)} className={`${pill} border-zinc-700 bg-zinc-800/60 text-zinc-200 hover:bg-zinc-700/60`}>
          Copy this page’s link
        </button>
        {p.admin?.claimUrl && (
          <button type="button" onClick={() => copy('Claim link', p.admin!.claimUrl!)} title="For the owner only — send it privately, never post it" className={`${pill} border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20`}>
            Copy claim link
          </button>
        )}
        {p.admin?.cardFrontUrl && p.admin?.cardBackUrl && (
          <span className={`${pill} border-violet-500/40 bg-violet-500/10 text-violet-200`}>
            Postcard:
            <a href={p.admin.cardFrontUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-white">front</a>
            ·
            <a href={p.admin.cardBackUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-white">back</a>
          </span>
        )}
        {note && <span className="text-xs text-zinc-300">{note}</span>}
      </div>
    </div>
  );
}
