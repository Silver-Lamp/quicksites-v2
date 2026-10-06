// lib/sites/siteProgress.ts
//
// WHERE DID THEY LEAVE OFF? One pure function over the rows we already keep about a site and
// the person who made it, producing a stage, a one-line summary and the owner's next step.
//
// Read by two surfaces that must agree: the "new site" email to the owner (lib/notifications/
// siteCreatedEmail.ts, via the cron) and the Sites column on /admin/users. Both call this; neither
// re-derives the story on its own.
//
// ⚠️ TWO AXES, NOT ONE LADDER. A guest builder's progress has a WORK axis (created → generated →
// edited → published) and a SIGN-UP axis (nothing → opened → submitted → email sent → account).
// Folding them into one ladder hides the thing that matters most: 21 of 21 builders edited nothing
// AND never typed an email, which is two different drop-offs with two different fixes.
//
// ⚠️ EVERYTHING HERE IS INFERRED FROM COUNTERS, AND THE COPY SAYS SO. `save_count` and
// `template_versions` are the only edit evidence (the version `diff` column is NULL on every
// recent row). "No edits saved" means no save landed, not that nobody typed. AI calls include the
// build's own generation, so a guest build normally shows 4–7 calls without a single click.
import { isDemoRecorderBusinessName } from '@/lib/demos/recorderIdentity';

export type WorkStage = 'created' | 'generated' | 'edited' | 'published';
export type SignupStage = 'none' | 'prompted' | 'opened' | 'submitted' | 'email_sent' | 'failed' | 'account';

export type SiteProgressInput = {
  template: {
    created_at: string;
    updated_at?: string | null;
    saved_at?: string | null;
    save_count?: number | null;
    published?: boolean | null;
    business_name?: string | null;
    industry?: string | null;
    claim_source?: string | null;
    /** template.data — only the page/block shape is read. */
    data?: unknown;
  };
  /** template_versions rows for this site. null = not loaded (the users list does not). */
  versions?: number | null;
  lastVersionAt?: string | null;
  /** ai_usage_events by this user (includes the build's own generation). null = not loaded. */
  aiCalls?: number | null;
  aiCostUsd?: number | null;
  lastAiAt?: string | null;
  /** guest_upgrade_events for this user, any order. */
  funnel?: Array<{ event: string; created_at: string }> | null;
  user?: {
    email?: string | null;
    is_anonymous?: boolean | null;
    created_at?: string | null;
    last_sign_in_at?: string | null;
  } | null;
};

export type SiteProgress = {
  work: WorkStage;
  signup: SignupStage;
  /** One sentence for a list row or an email subject line. */
  summary: string;
  /** The evidence, one fact per line. */
  details: string[];
  /** What the owner could do about it. */
  nextStep: string;
  lastActivityAt: string | null;
  /** Minutes from creation to the last thing we can see them do. */
  minutesActive: number | null;
  pages: number;
  blocks: string[];
};

const ms = (iso: string | null | undefined): number | null => {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : null;
};
const latest = (...isos: Array<string | null | undefined>): string | null =>
  isos.filter((x): x is string => !!x && ms(x) !== null).sort((a, b) => ms(b)! - ms(a)!)[0] ?? null;

/** First-page block types, in order, from template.data. Tolerates every shape we have shipped. */
export function blockTypesOf(data: unknown): { pages: number; blocks: string[] } {
  const d = data as { pages?: Array<{ blocks?: Array<{ type?: string }>; content_blocks?: Array<{ type?: string }> }> } | null;
  const pages = Array.isArray(d?.pages) ? d!.pages! : [];
  const first = pages[0];
  const list = (first?.blocks?.length ? first.blocks : first?.content_blocks) ?? [];
  return { pages: pages.length, blocks: list.map((b) => String(b?.type ?? '')).filter(Boolean) };
}

const SIGNUP_RANK: Record<SignupStage, number> = { none: 0, prompted: 1, opened: 2, failed: 3, submitted: 3, email_sent: 4, account: 5 };

function signupStage(input: SiteProgressInput): SignupStage {
  if (input.user && input.user.is_anonymous === false) return 'account';
  let best: SignupStage = 'none';
  for (const e of input.funnel ?? []) {
    const s: SignupStage | null =
      e.event === 'prompt_shown' ? 'prompted'
      : e.event === 'signup_opened' ? 'opened'
      : e.event === 'signup_submitted' || e.event === 'signup_existing_account' ? 'submitted'
      : e.event === 'signup_email_sent' ? 'email_sent'
      : e.event === 'signup_failed' ? 'failed'
      : null;
    if (s && SIGNUP_RANK[s] > SIGNUP_RANK[best]) best = s;
  }
  return best;
}

function workStage(input: SiteProgressInput): WorkStage {
  const t = input.template;
  if (t.published) return 'published';
  if ((t.save_count ?? 0) > 0 || (input.versions ?? 0) > 0) return 'edited';
  if ((input.aiCalls ?? 0) > 0) return 'generated';
  return 'created';
}

export function analyzeSiteProgress(input: SiteProgressInput, nowIso?: string): SiteProgress {
  const t = input.template;
  const work = workStage(input);
  const signup = signupStage(input);
  const { pages, blocks } = blockTypesOf(t.data);

  const funnelLast = latest(...(input.funnel ?? []).map((e) => e.created_at));
  const lastActivityAt = latest(t.saved_at, input.lastVersionAt, input.lastAiAt, funnelLast, t.updated_at);
  const created = ms(t.created_at);
  const last = ms(lastActivityAt);
  const minutesActive = created !== null && last !== null ? Math.max(0, Math.round((last - created) / 60000)) : null;

  const saves = t.save_count ?? input.versions ?? 0;
  const workPhrase =
    work === 'published' ? 'published'
    : work === 'edited' ? `saved ${saves} edit${saves === 1 ? '' : 's'}`
    : work === 'generated' ? `built with AI (${input.aiCalls} call${input.aiCalls === 1 ? '' : 's'}), no edits saved`
    // aiCalls unknown (the users list does not load it): say only what we can see.
    : input.aiCalls == null ? 'no edits saved'
    : 'created, nothing generated or saved';

  const signupPhrase =
    signup === 'account' ? 'has an account'
    : signup === 'email_sent' ? 'sign-up email sent, not confirmed'
    : signup === 'submitted' ? 'submitted sign-up, no confirmation email recorded'
    : signup === 'failed' ? 'sign-up attempt failed'
    : signup === 'opened' ? 'opened sign-up, did not submit'
    : signup === 'prompted' ? 'saw the sign-up prompt, never opened it'
    : 'never saw a sign-up prompt';

  const active =
    minutesActive === null ? ''
    : minutesActive === 0 ? ' Last activity within a minute of creation.'
    : ` Last activity ${minutesActive} min after creation.`;

  const summary = `${cap(workPhrase)}; ${signupPhrase}.${active}`;

  const details: string[] = [];
  details.push(`${pages} page${pages === 1 ? '' : 's'}${blocks.length ? `: ${blocks.join(', ')}` : ''}`);
  if (input.aiCalls != null) details.push(`AI calls by this user: ${input.aiCalls}${input.aiCostUsd != null ? ` ($${input.aiCostUsd.toFixed(2)})` : ''}`);
  if (input.versions != null) details.push(`Versions saved: ${input.versions}${t.save_count != null ? ` (save_count ${t.save_count})` : ''}`);
  if (input.funnel?.length) details.push(`Sign-up events: ${input.funnel.map((e) => e.event).join(' → ')}`);
  if (input.user) details.push(input.user.is_anonymous === false ? `Account: ${input.user.email ?? 'no email'}` : 'Anonymous guest session — no email on record');

  const nextStep =
    work === 'published' ? 'Live. Nothing to do.'
    : signup === 'account' ? `Has an account but has not published — a "ready to go live?" note to ${input.user?.email ?? 'their email'} is the move.`
    : signup === 'email_sent' ? 'Confirmation email went out and was not clicked — check deliverability; a personal email from you may land where the automated one did not.'
    : signup === 'submitted' ? 'Submitted the sign-up form but no confirmation email was recorded — look at the signup_failed events before assuming they walked away.'
    : signup === 'failed' ? 'Their sign-up attempt failed — the reason is in guest_upgrade_events; this is the one you can fix.'
    : signup === 'opened' ? 'Opened sign-up and did not submit — the form itself is the drop-off.'
    : work === 'edited' ? 'Edited the site and never opened sign-up — they did not reach the publish gate. No email on record; nothing to reply to.'
    : work === 'generated' ? 'Looked at the generated site and left. No email on record; nothing to reply to — the first impression is the only lever.'
    : 'Created and abandoned before anything was generated — likely a bounce or a timeout during the build.';

  return { work, signup, summary, details, nextStep, lastActivityAt, minutesActive, pages, blocks };
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export type TestTrafficReason = 'demo_recorder' | 'owner_test_account' | 'operator' | null;

/**
 * Is this site ours rather than a stranger's? The owner must not be emailed about his own test
 * builds — 18 of the last 18 signed-in creations were `sandonjurowski+tester2@gmail.com`, and
 * four guest builds were the demo recorder. Reported on the admin page, never emailed.
 */
export function testTrafficReason(args: {
  businessName?: string | null;
  userEmail?: string | null;
  isAdminUser?: boolean;
  adminEmails: string[];
}): TestTrafficReason {
  if (args.isAdminUser) return 'operator';
  if (isDemoRecorderBusinessName(args.businessName)) return 'demo_recorder';
  const email = (args.userEmail ?? '').trim().toLowerCase();
  if (email) {
    const [local, domain] = email.split('@');
    const base = (local ?? '').split('+')[0];
    for (const a of args.adminEmails) {
      const [al, ad] = a.trim().toLowerCase().split('@');
      if (!al || !ad) continue;
      if (ad === domain && al.split('+')[0] === base) return 'owner_test_account';
    }
  }
  return null;
}
