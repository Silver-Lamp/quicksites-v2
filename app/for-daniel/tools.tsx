// app/for-daniel/tools.tsx
//
// "Your tools" — every surface Daniel uses, one card each, from the page he already has
// (owner, 2026-10-13: "so that he can get to each of his tools … when he's logged in, prompt
// him to log in if he clicks one of the items that requires auth"). Server component: it reads
// the session cookie, so a signed-in Daniel gets the tool directly and a signed-out one gets
// the sign-in page with `next=` pointing back at the tool. Public tools link straight through.
//
// The rep pages are listed from the database (his partner-minted codes), so the card is true the
// moment he adds a rep and says "none yet" until then.
import Link from 'next/link';
import { getServerSupabase } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { signInHref } from '@/lib/auth/authLinks';
import { listReps } from '@/lib/partners/repCodes';

const PARTNER_CODE = 'daniel';

type Tool = { title: string; line: string; href: string; auth: boolean; external?: boolean };

const TOOLS: Tool[] = [
  { title: 'Partner dashboard', line: 'Your reps, the white-label steps, payouts, earnings by restaurant.', href: '/partners/dashboard', auth: true },
  { title: 'Add a rep', line: 'Name, email, city — mints their code and their page.', href: '/partners/dashboard#reps', auth: true },
  { title: 'Referral earnings', line: 'Signups, accrued, held and paid under your code.', href: '/referrals/dashboard', auth: true },
  { title: 'Plan a route', line: 'Paste the day’s stops, get an efficient order and a Maps link.', href: '/tools/route-planner', auth: false },
  { title: 'Toast vs. us', line: 'The honest comparison for a restaurant already on Toast or Square.', href: '/compare/toast', auth: false },
  { title: 'Spread the word', line: 'The public page you can share with anyone who knows a restaurant.', href: '/spread-the-word', auth: false },
];

export default async function ToolsCard() {
  const supa = await getServerSupabase();
  const {
    data: { user },
  } = await supa.auth.getUser();
  const signedIn = !!user && !(user as { is_anonymous?: boolean }).is_anonymous;

  // His reps: the partner-minted codes under `daniel`, read as the operator (no session needed).
  const { data: owner } = await supabaseAdmin.from('referral_codes').select('owner_id').eq('code', PARTNER_CODE).maybeSingle();
  const ownerId = (owner as { owner_id?: string | null } | null)?.owner_id ?? null;
  const reps = ownerId ? await listReps(ownerId, [PARTNER_CODE]).catch(() => []) : [];

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
        {TOOLS.map((t) => (
          <li key={t.href}>
            <Link href={hrefFor(t)} className="block rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 transition-colors hover:border-emerald-500/50">
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold text-white">{t.title}</span>
                {t.auth ? (
                  <span className="text-[11px] text-zinc-500">{signedIn ? '' : '🔒 sign in'}</span>
                ) : null}
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-zinc-400">{t.line}</span>
            </Link>
          </li>
        ))}
        <li>
          <div className="block rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <span className="text-sm font-semibold text-white">Your links</span>
            <span className="mt-1 block text-xs leading-relaxed text-zinc-400">
              Restaurants sign up: <code className="text-zinc-300">quicksites.ai/join/{PARTNER_CODE}</code>
              <br />
              Anyone: <code className="text-zinc-300">quicksites.ai/?ref={PARTNER_CODE}</code>
              <br />
              Recruit a reseller under you: <code className="text-zinc-300">quicksites.ai/partners/resellers?hub={PARTNER_CODE}</code>
            </span>
          </div>
        </li>
        <li>
          <div className="block rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <span className="text-sm font-semibold text-white">Your reps’ pages</span>
            {reps.length === 0 ? (
              <span className="mt-1 block text-xs leading-relaxed text-zinc-400">None yet — add one from the dashboard and their page appears here.</span>
            ) : (
              <ul className="mt-1 list-none space-y-1 p-0 text-xs">
                {reps.map((r) => (
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
      </ul>
    </section>
  );
}
