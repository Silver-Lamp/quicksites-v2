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
