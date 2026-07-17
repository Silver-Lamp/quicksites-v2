// lib/admin/setupActions.ts
//
// Super-admin SETUP action items — one-time, run-once provisioning tasks that would
// otherwise live only as "POST this URL from the console" tribal knowledge. Each
// action declares how to DETECT whether it's done and which admin endpoint runs it,
// so the ops dashboard can surface a dismissable "Run now" card until it's complete.
// Distinct from lib/ops/nextSteps.ts (recurring health signals) — these are done
// forever once done.
//
// Adding a setup action = one entry here. The status route resolves `check` against
// the DB; the client renders + POSTs `runEndpoint`.

export type SetupActionState = {
  key: string;
  title: string;
  /** One line shown under the title (interpolated with the check's count when relevant). */
  detail: string;
  cta: string;
  runEndpoint: string;
  runBody?: Record<string, any>;
  /** Resolved server-side: is it already done? */
  done: boolean;
  /** Optional public URL to view the result once done. */
  resultHref?: string;
  /** Optional count surfaced in the UI (e.g. "12 starters seeded"). */
  count?: number;
};

export type SetupActionDef = {
  key: string;
  title: string;
  detail: string;
  cta: string;
  runEndpoint: string;
  runBody?: Record<string, any>;
  /** Returns { done, count?, resultHref? } — given an untyped service-role client. */
  check: (db: any) => Promise<{ done: boolean; count?: number; resultHref?: string }>;
};

export const SETUP_ACTIONS: SetupActionDef[] = [
  {
    key: 'seed_author_demo',
    title: 'Seed the Arlo V. author demo storefront',
    detail:
      'The standing HJ Author Sites demo — a persona author with a real Lulu paperback + audiobook, imported through the artifact bridge.',
    cta: 'Seed demo',
    runEndpoint: '/api/admin/templates/seed-author-demo',
    check: async (db) => {
      const { data } = await db.from('templates').select('id, published').eq('slug', 'arlo-v-books').maybeSingle();
      return { done: !!data, resultHref: data ? '/sites/arlo-v-books' : undefined };
    },
  },
  {
    key: 'seed_starters',
    title: 'Seed per-industry starter templates',
    detail:
      'Populates the "Duplicate a template" picker across all industries; storefront industries get stocked demo catalogs.',
    cta: 'Seed all',
    runEndpoint: '/api/admin/templates/seed-starters',
    runBody: { all: true },
    check: async (db) => {
      // Data-driven starters carry data.meta.is_starter=true.
      const { count } = await db
        .from('templates')
        .select('id', { count: 'exact', head: true })
        .eq('data->meta->>is_starter', 'true');
      const n = Number(count || 0);
      // "Done enough" once a healthy library exists — a few strays shouldn't nag.
      return { done: n >= 10, count: n };
    },
  },
];

/** Resolve every setup action's state against the DB. */
export async function resolveSetupActions(db: any): Promise<SetupActionState[]> {
  const out: SetupActionState[] = [];
  for (const a of SETUP_ACTIONS) {
    let state: { done: boolean; count?: number; resultHref?: string } = { done: false };
    try {
      state = await a.check(db);
    } catch {
      /* leave as not-done; surfacing the action is safer than hiding it on a check error */
    }
    out.push({
      key: a.key,
      title: a.title,
      detail: a.detail,
      cta: a.cta,
      runEndpoint: a.runEndpoint,
      ...(a.runBody ? { runBody: a.runBody } : {}),
      done: state.done,
      ...(state.count != null ? { count: state.count } : {}),
      ...(state.resultHref ? { resultHref: state.resultHref } : {}),
    });
  }
  return out;
}
