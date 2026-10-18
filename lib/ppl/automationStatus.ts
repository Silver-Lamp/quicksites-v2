// lib/ppl/automationStatus.ts — which pay-per-call automations are OFF, for the foot of every
// email on this path (owner, 2026-10-18: "add the cron reminders in each of the emails when off").
//
// A lead alert that arrives while the pitch cron is off must say so, or the owner reads the
// alert, assumes the machine will text the business, and nothing does. Reads the flags the
// crons themselves read; says nothing when everything is on.
export type AutomationFlag = { key: string; label: string; whenOff: string };


export const AUTOMATION_FLAGS: AutomationFlag[] = [
  { key: 'PPL_PITCH_AUTO_ENABLED', label: 'Pitch cron', whenOff: 'no business is texted the offer or the follow-up by itself — each send is a button on /admin/ppl, and no "Vet" / "Intervene" reminders go out' },
  { key: 'PPL_OUTCOME_SURVEY_ENABLED', label: 'Did-it-become-a-job text', whenOff: 'nobody is asked whether a call became a job, so the conversion measurement is not running' },
  { key: 'PPL_ENABLED', label: 'Pay-per-call billing', whenOff: 'calls bridge and are logged but nothing is charged, even on an account with a deposit' },
];

export type EnvLike = Record<string, string | undefined>;

export function automationsOff(env: EnvLike = process.env): AutomationFlag[] {
  return AUTOMATION_FLAGS.filter((f) => !(env[f.key] === '1' || env[f.key] === 'true'));
}

export function automationRemindersText(env: EnvLike = process.env): string {
  const off = automationsOff(env);
  if (!off.length) return '';
  return `Automation OFF: ${off.map((f) => `${f.label} (${f.key}) — ${f.whenOff}`).join(' · ')}. Set the flag to 1 in Vercel and redeploy to turn one on.`;
}

export function automationRemindersHtml(env: EnvLike = process.env): string {
  const off = automationsOff(env);
  if (!off.length) return '';
  return `<div style="margin-top:14px;padding:10px 12px;border:1px solid #f59e0b55;background:#f59e0b14;border-radius:8px;font:12px/1.5 -apple-system,Segoe UI,sans-serif;color:#d4d4d8">
    <strong style="color:#fbbf24">Automation off</strong>
    <ul style="margin:6px 0 0 16px;padding:0">${off.map((f) => `<li><strong>${f.label}</strong> (<code>${f.key}</code>) — ${f.whenOff}.</li>`).join('')}</ul>
    <div style="margin-top:6px;color:#a1a1aa">Set the flag to 1 in Vercel and redeploy to turn one on.</div>
  </div>`;
}

