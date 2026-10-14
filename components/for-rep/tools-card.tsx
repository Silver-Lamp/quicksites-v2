// components/for-rep/tools-card.tsx
//
// "Your tools" — the surfaces one person uses, one card each, on their /for-<name> page (owner,
// 2026-10-13: "so that he can get to each of his tools … prompt him to log in if he clicks one
// of the items that requires auth"; then "update for-amy and for-daryle to have the same
// simplified interfaces that link to tools"). Server component: it reads the session cookie, so
// a signed-in person gets the tool directly and a signed-out one gets the sign-in page with
// `next=` pointing back at the tool. Public tools link straight through. An anonymous guest
// session is not "signed in".
//
// With a `code`, the card also shows that person's links; with `reps`, the partner-minted rep
// pages under that code (lib/partners/repCodes.ts), read from the database so the list is true
// the moment one is added.
import Link from 'next/link';
import { getServerSupabase } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { signInHref } from '@/lib/auth/authLinks';
import { listReps } from '@/lib/partners/repCodes';

export type Tool = { title: string; line: string; href: string; auth: boolean };

export default async function ToolsCard({ tools, code = null, reps = false }: { tools: Tool[]; code?: string | null; reps?: boolean }) {
  const supa = await getServerSupabase();
  const {
    data: { user },
  } = await supa.auth.getUser();
  const signedIn = !!user && !(user as { is_anonymous?: boolean }).is_anonymous;

  let repRows: Awaited<ReturnType<typeof listReps>> = [];
  if (reps && code) {
    const { data: owner } = await supabaseAdmin.from('referral_codes').select('owner_id').eq('code', code).maybeSingle();
    const ownerId = (owner as { owner_id?: string | null } | null)?.owner_id ?? null;
    repRows = ownerId ? await listReps(ownerId, [code]).catch(() => []) : [];
  }

  const hrefFor = (t: Tool) => (t.auth && !signedIn ? signInHref(t.href) : t.href);

  return (
    <section className="mx-auto max-w-3xl px-6 pb-2 pt-2">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">Your tools</h2>
        <span className="text-xs text-zinc-500">
          {signedIn ? `Signed in as ${user?.email ?? 'you'}` : 'Not signed in — a tool with a lock asks you to sign in, then opens.'}
        </span>
      </div>
      <ul className="mt-3 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2">
        {tools.map((t) => (
          <li key={t.href}>
            <Link href={hrefFor(t)} className="block rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 transition-colors hover:border-emerald-500/50">
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold text-white">{t.title}</span>
                {t.auth && !signedIn ? <span className="text-[11px] text-zinc-500">🔒 sign in</span> : null}
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-zinc-400">{t.line}</span>
            </Link>
          </li>
        ))}
        {code ? (
          <li>
            <div className="block rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <span className="text-sm font-semibold text-white">Your links</span>
              <span className="mt-1 block text-xs leading-relaxed text-zinc-400">
                Merchants sign up: <code className="text-zinc-300">quicksites.ai/join/{code}</code>
                <br />
                Anyone: <code className="text-zinc-300">quicksites.ai/?ref={code}</code>
                <br />
                Recruit a reseller under you: <code className="text-zinc-300">quicksites.ai/partners/resellers?hub={code}</code>
              </span>
            </div>
          </li>
        ) : null}
        {reps && code ? (
          <li>
            <div className="block rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <span className="text-sm font-semibold text-white">Your reps’ pages</span>
              {repRows.length === 0 ? (
                <span className="mt-1 block text-xs leading-relaxed text-zinc-400">None yet — add one from the dashboard and their page appears here.</span>
              ) : (
                <ul className="mt-1 list-none space-y-1 p-0 text-xs">
                  {repRows.map((r) => (
                    <li key={r.code}>
                      <Link href={`/for/${encodeURIComponent(r.code)}`} className="text-emerald-300 underline underline-offset-4 hover:text-emerald-200">
                        {r.name}
                      </Link>
                      <span className="text-zinc-500">
                        {' '}
                        · {r.city ? `${r.city}${r.region ? `, ${r.region}` : ''}` : 'no city yet'} · {r.signups} signup{r.signups === 1 ? '' : 's'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        ) : null}
      </ul>
    </section>
  );
}
