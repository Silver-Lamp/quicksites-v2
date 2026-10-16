/**
 * @jest-environment node
 */
// The tenant contact form writes `form_submissions` with the ANON key. That table lets anon
// insert and update but only admins read (20260627), so an insert followed by `.select()` is
// refused by PostgREST as an RLS violation — and every tenant contact form failed for 3½ months
// (no row after 2026-04-08; found 2026-10-16). The form must insert without a returning select
// and mint the row id itself.
import fs from 'node:fs';
import path from 'node:path';
import { stripComments } from '@/test/stripComments';

const src = stripComments(fs.readFileSync(path.join(process.cwd(), 'components/admin/templates/render-blocks/contact-form.tsx'), 'utf8'));

describe('contact form submission under the form_submissions RLS policies', () => {
  it('inserts without a returning select', () => {
    const insertCall = src.slice(src.indexOf(".from('form_submissions')"), src.indexOf(".from('form_submissions')") + 400);
    expect(insertCall).toMatch(/\.insert\(\[/);
    expect(insertCall).not.toMatch(/\.insert\([\s\S]*?\]\)\s*\.select\(/);
  });
  it('mints the row id client-side so the email route and the status update can name it', () => {
    expect(src).toMatch(/randomUUID/);
    expect(src).toMatch(/id: submissionId/);
    expect(src).toMatch(/form_submission_id: data\.id/);
  });
  it('derives the site slug from /sites/<slug> before the host (the host-only rule filed platform-path leads under "www")', () => {
    expect(src).toMatch(/\/\^\\\/sites\\\/\(\[\^\/\?#\]\+\)\/\.exec\(window\.location\.pathname\)/);
    expect(src.indexOf('fromPath')).toBeLessThan(src.indexOf("host.endsWith('.quicksites.ai')"));
  });
  it('never updates form_submissions from the browser; the email route records the fate with the service role', () => {
    const insertAt = src.indexOf(".from('form_submissions')");
    expect(src.indexOf(".from('form_submissions')", insertAt + 1)).toBe(-1);
    const route = stripComments(fs.readFileSync(path.join(process.cwd(), 'app/api/send-contact-email/route.ts'), 'utf8'));
    expect(route).toMatch(/from\('form_submissions'\)\.update\(\{ email_status, email_response_id, email_error \}\)\.eq\('id', submissionId\)/);
    expect(route).toMatch(/await recordFate\(status, response_id, error\)/);
    expect(route).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
  });
  it('the migration still grants anon insert + update and admin-only select (the contract this form codes to)', () => {
    const mig = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/20260627_rls_logs_forms_batch.sql'), 'utf8');
    expect(mig).toMatch(/form_submissions_public_insert[\s\S]*for insert to anon, authenticated with check \(true\)/);
    expect(mig).toMatch(/form_submissions_admin_select[\s\S]*for select using \(public\.is_platform_admin\(\)\)/);
  });
});
