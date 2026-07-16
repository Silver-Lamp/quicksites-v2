// lib/menu/goLiveChecklist.ts
//
// Live launch-readiness for the delivered.menu no-website funnel — the runbook
// (docs/DELIVERED_MENU_GO_LIVE.md) as auto-detected state, so a super-admin can see at a
// glance what's wired and what's left before turning it on. Env/flag presence + a few DB
// probes; the genuinely un-detectable steps (DNS wildcard, placing QRs) are marked 'manual'.
import { supabaseAdmin } from '@/lib/supabase/admin';
import { MENU_BASE_DOMAIN } from '@/lib/menu/deliveredMenu';
import { MENU_DEMAND_CAPTURE_ENABLED, MENU_DEMAND_CAPTURE_SMS, MENU_DRAFT_INDEXABLE } from '@/lib/flags/menuDemand';
import { getSenderProfile, senderProfileReady } from '@/lib/outreach/senderProfile';

export type CheckStatus = 'ready' | 'todo' | 'optional' | 'manual';
export type GoLiveCheck = { key: string; label: string; status: CheckStatus; detail?: string };
export type GoLiveGroup = { title: string; checks: GoLiveCheck[] };
export type GoLiveChecklist = { groups: GoLiveGroup[]; readyRequired: number; totalRequired: number };

const has = (v: string | undefined | null) => !!(v && String(v).trim());

export async function loadGoLiveChecklist(): Promise<GoLiveChecklist> {
  // DB probes (best-effort)
  let tablesReady = false;
  let drafts = 0;
  let intents = 0;
  try {
    const { error } = await supabaseAdmin.from('demand_events').select('id', { head: true, count: 'exact' }).limit(1);
    tablesReady = !error;
  } catch { /* not migrated */ }
  try {
    const { count } = await supabaseAdmin.from('templates').select('id', { head: true, count: 'exact' }).eq('claim_source', 'listing_import');
    drafts = count ?? 0;
  } catch { /* ignore */ }
  try {
    const { count } = await supabaseAdmin.from('demand_events').select('id', { head: true, count: 'exact' });
    intents = count ?? 0;
  } catch { /* ignore */ }

  const sender = await getSenderProfile().catch(() => null);
  const senderOk = !!sender && senderProfileReady(sender);

  const twilioOk = has(process.env.TWILIO_ACCOUNT_SID) && has(process.env.TWILIO_AUTH_TOKEN) &&
    (has(process.env.TWILIO_FROM) || has(process.env.TWILIO_PHONE_NUMBER) || has(process.env.TWILIO_MESSAGING_SERVICE_SID));

  const groups: GoLiveGroup[] = [
    {
      title: '1 · Infrastructure',
      checks: [
        { key: 'migrations', label: 'Demand tables migrated', status: tablesReady ? 'ready' : 'todo', detail: tablesReady ? 'demand_events present' : 'run npm run db:migrate:up' },
        { key: 'menu_domain', label: 'NEXT_PUBLIC_MENU_BASE_DOMAIN set', status: has(MENU_BASE_DOMAIN) ? 'ready' : 'todo', detail: has(MENU_BASE_DOMAIN) ? MENU_BASE_DOMAIN : 'e.g. delivered.menu' },
        { key: 'dns', label: 'DNS pointed (apex + www + *.wildcard)', status: 'manual', detail: 'verify in Vercel → Domains' },
      ],
    },
    {
      title: '2 · Flags',
      checks: [
        { key: 'capture', label: 'MENU_DEMAND_CAPTURE_ENABLED', status: MENU_DEMAND_CAPTURE_ENABLED ? 'ready' : 'todo', detail: MENU_DEMAND_CAPTURE_ENABLED ? 'on' : 'off' },
        { key: 'indexable', label: 'MENU_DRAFT_INDEXABLE (flip at go-live)', status: MENU_DRAFT_INDEXABLE ? 'ready' : 'todo', detail: MENU_DRAFT_INDEXABLE ? 'on — drafts indexable' : 'off — drafts noindex' },
        { key: 'sms', label: 'MENU_DEMAND_CAPTURE_SMS (keep off for now)', status: 'optional', detail: MENU_DEMAND_CAPTURE_SMS ? 'ON' : 'off (held until Phase 1 proves out)' },
      ],
    },
    {
      title: '3 · Keys',
      checks: [
        { key: 'places', label: 'GOOGLE_PLACES_API_KEY', status: has(process.env.GOOGLE_PLACES_API_KEY) ? 'ready' : 'todo' },
        { key: 'openai', label: 'OPENAI_API_KEY (menu OCR)', status: has(process.env.OPENAI_API_KEY) ? 'ready' : 'todo' },
        { key: 'stripe', label: 'STRIPE_SECRET_KEY + webhook (money path)', status: has(process.env.STRIPE_SECRET_KEY) && has(process.env.STRIPE_WEBHOOK_SECRET) ? 'ready' : 'todo' },
        { key: 'yelp', label: 'YELP_API_KEY (raises menu hit-rate)', status: has(process.env.YELP_API_KEY) ? 'ready' : 'optional' },
        { key: 'twilio', label: 'Twilio (only for Phase-2 SMS / claim OTP)', status: twilioOk ? 'ready' : 'optional' },
      ],
    },
    {
      title: '4 · Identity',
      checks: [
        { key: 'sender', label: 'Sender profile (name + email)', status: senderOk ? 'ready' : 'todo', detail: senderOk ? (sender?.name ?? '') : 'set on /admin/growth?tab=prospects' },
      ],
    },
    {
      title: '5 · Cohort',
      checks: [
        { key: 'drafts', label: 'Cohort imported (drafts built)', status: drafts > 0 ? 'ready' : 'todo', detail: `${drafts} draft${drafts === 1 ? '' : 's'} · npm run import:listings -- leads.json` },
        { key: 'qr', label: 'Diner order QRs placed', status: 'manual', detail: 'print <slug>-order.png or the "Order QR" on /admin/outreach' },
        // Post-launch OUTCOME, not a prep prerequisite — order intents can't flow until
        // drafts are indexable + QRs are out, so this is a non-blocking signal (green once
        // it's happening) rather than a required step that caps the readiness meter.
        { key: 'demand', label: 'Demand flowing (post-launch signal)', status: intents > 0 ? 'ready' : 'optional', detail: intents > 0 ? `${intents} order intent${intents === 1 ? '' : 's'} logged` : 'appears once drafts go indexable + QRs are placed' },
      ],
    },
  ];

  const required = groups.flatMap((g) => g.checks).filter((c) => c.status === 'ready' || c.status === 'todo');
  const readyRequired = required.filter((c) => c.status === 'ready').length;

  return { groups, readyRequired, totalRequired: required.length };
}
