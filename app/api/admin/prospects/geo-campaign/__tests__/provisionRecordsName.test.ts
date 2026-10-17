// Provisioning a number must record the forward-to's NAME, not just its number — the caller is
// told who is about to answer (lib/ppl/forwardAnnounce.ts), and setCampaignTracking alone left
// every new line announcing "a local towing company serving <city>".
import fs from 'node:fs';
import path from 'node:path';

it('provision-number resolves the business name right after writing the tracking number', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'app/api/admin/prospects/geo-campaign/provision-number/route.ts'), 'utf8');
  const tracking = src.indexOf('await setCampaignTracking(campaignId, { number: phoneNumber, sid, forwardTo });');
  const name = src.indexOf('await setCampaignForwardTo(campaignId, forwardTo)');
  expect(tracking).toBeGreaterThan(-1);
  expect(name).toBeGreaterThan(tracking);
  expect(name - tracking).toBeLessThan(600);
});

it('provision-number refuses a campaign with no pitch site BEFORE it buys anything', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'app/api/admin/prospects/geo-campaign/provision-number/route.ts'), 'utf8');
  const refuse = src.indexOf("code: 'no_pitch_site'");
  const buy = src.indexOf('await provisionTrackingNumber(');
  expect(refuse).toBeGreaterThan(-1);
  expect(refuse).toBeLessThan(buy);
});

it('the forward-to name resolver narrows on the phone server-side (PostgREST returns at most 1,000 rows, whatever .limit says)', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'lib/outreach/resolveBusinessName.ts'), 'utf8');
  expect(src).toMatch(/\.or\(`phone\.ilike\.%\$\{dashed\},phone\.ilike\.%\$\{tail7\}`\)/);
  expect(src).toMatch(/last10\(row\.phone\) === key/);
  expect(src).not.toMatch(/^\s*\.limit\(5000\)/m); // as CODE — the comment explaining the old cap is allowed (§4)
});
