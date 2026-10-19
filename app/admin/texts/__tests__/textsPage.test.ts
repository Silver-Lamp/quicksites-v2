// app/admin/texts/__tests__/textsPage.test.ts — the browser texting UI sends only through the
// operator route, which honours STOP and texts only a campaign's own forward-to.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../../..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');

describe('/admin/texts', () => {
  it('is admin-gated, noindex, and reads sms_messages', () => {
    const page = read('app/admin/texts/page.tsx');
    expect(page).toMatch(/getAdminUser\(\)/);
    expect(page).toMatch(/redirect\('\/'\)/);
    expect(page).toMatch(/index: false/);
    expect(page).toMatch(/from\('sms_messages'\)/);
  });
  it('every composer posts to the operator route and nowhere else; no raw number is ever sent from the browser', () => {
    for (const f of ['app/admin/texts/texts-client.tsx', 'components/admin/ppl-pitch-call-tool.tsx']) {
      const src = read(f);
      const posts = src.match(/fetch\('\/api\/[^']+'/g) ?? [];
      for (const p of posts) expect(p).toMatch(/\/api\/admin\/(ppl|creative)\//);
      expect(src).not.toMatch(/to_number|toNumber|phone:\s*body/);
    }
    expect(read('app/admin/texts/texts-client.tsx')).toMatch(/\/api\/admin\/ppl\/text-business/);
  });
  it('the operator route honours STOP and labels the send', () => {
    const route = read('app/api/admin/ppl/text-business/route.ts');
    expect(route.indexOf('isOptedOut(')).toBeLessThan(route.indexOf('sendSms('));
    expect(route).toMatch(/reason: 'operator_text'/);
  });
});
