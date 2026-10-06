// lib/notifications/siteCreatedEmail.ts
//
// "Someone built a site" → one email to the owner, with where they left off (owner, 2026-10-05).
//
// ⚠️ Sent by a cron ~30 minutes after creation, never from the create route: at creation there
// is nothing to analyse, and the create route's job is to return an editor fast. Half an hour
// later the saves, the AI calls and the sign-up events have happened or they have not, and that
// difference is the whole content of the email.
import type { SiteProgressReport } from '@/lib/sites/siteProgressServer';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const WORK_LABEL = { created: 'created only', generated: 'generated, unedited', edited: 'edited', published: 'published' } as const;

export function buildSiteCreatedEmail(r: SiteProgressReport, base: string): { subject: string; html: string; text: string } {
  const name = r.template.business_name ?? r.template.slug ?? 'Untitled site';
  const who = r.user?.is_anonymous === false ? (r.user.email ?? r.identity.name ?? 'account') : 'guest';
  const where = [r.geo?.city, r.geo?.region, r.geo?.country].filter(Boolean).join(', ');
  const source = r.template.claim_source === 'guest_build' ? 'guest build (homepage / /build)' : r.template.claim_source ?? 'signed-in editor';
  const editor = `${base}/admin/templates/${r.template.id}`;
  // `||`, not `??`: an anonymous Supabase user has email '' and the page can search by id.
  const usersLink = `${base}/admin/users?q=${encodeURIComponent(r.user?.email || r.template.owner_id || '')}`;
  const preview = r.template.slug ? `${base}/sites/${r.template.slug}` : null;

  const subject = `🆕 New site: ${name}${r.template.industry ? ` (${r.template.industry})` : ''} — ${WORK_LABEL[r.progress.work]}, ${who}`;

  const rows: Array<[string, string]> = [
    ['Site', name],
    ['Industry', r.template.industry ?? '—'],
    ['Created', new Date(r.template.created_at).toUTCString()],
    ['Source', source],
    ['Who', who === 'guest' ? 'Anonymous guest — no email on record' : who],
    ['Signed up from', where || '— (not captured)'],
  ];

  const text = [
    `New site: ${name}`,
    ...rows.map(([k, v]) => `${k}: ${v}`),
    '',
    `Where they left off: ${r.progress.summary}`,
    ...r.progress.details.map((d) => `  • ${d}`),
    '',
    `Next step: ${r.progress.nextStep}`,
    '',
    `Editor: ${editor}`,
    preview ? `Preview: ${preview}` : '',
    `User row: ${usersLink}`,
  ].filter((l) => l !== '').join('\n');

  const html = `
    <div style="font-family:system-ui,-apple-system,sans-serif;font-size:14px;color:#111;line-height:1.5">
      <h2 style="margin:0 0 12px">New site: ${esc(name)}</h2>
      <table style="border-collapse:collapse">
        ${rows.map(([k, v]) => `<tr><td style="padding:2px 16px 2px 0;color:#666;vertical-align:top">${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}
      </table>
      <h3 style="margin:18px 0 6px;font-size:14px">Where they left off</h3>
      <p style="margin:0 0 8px"><strong>${esc(r.progress.summary)}</strong></p>
      <ul style="margin:0 0 12px;padding-left:18px;color:#444">
        ${r.progress.details.map((d) => `<li>${esc(d)}</li>`).join('')}
      </ul>
      <p style="margin:0 0 16px;padding:10px 12px;background:#f3f4f6;border-radius:6px"><strong>Next step:</strong> ${esc(r.progress.nextStep)}</p>
      <p style="margin:0"><a href="${esc(editor)}">Open in the editor →</a>${preview ? ` &nbsp;·&nbsp; <a href="${esc(preview)}">Preview</a>` : ''} &nbsp;·&nbsp; <a href="${esc(usersLink)}">User row on /admin/users</a></p>
      <p style="margin-top:24px;color:#999;font-size:12px">Sent about 30 minutes after the site was created, so the saves and sign-up events had time to land. Counters, not observation: "no edits saved" means no save landed. You're receiving this because your address is in ADMIN_EMAILS.</p>
    </div>`;

  return { subject, html, text };
}
