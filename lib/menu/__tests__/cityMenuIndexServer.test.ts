import { menuFinderCampaignId } from '../cityMenuIndexServer';

describe('menuFinderCampaignId', () => {
  const blk = (id: any) => ({ type: 'menu_finder', content: { campaign_id: id } });

  it('finds the campaign the block is pointed at', () => {
    expect(menuFinderCampaignId({ pages: [{ content_blocks: [blk('abc')] }] })).toBe('abc');
  });

  // ⚠️ Both arrays. A page stores its block list twice; reading only one is how a page ends up
  // silently server-rendering nothing while looking correctly configured.
  it('reads the blocks array too', () => {
    expect(menuFinderCampaignId({ pages: [{ blocks: [blk('xyz')] }] })).toBe('xyz');
  });

  it('returns null when there is no finder, or it is unlinked', () => {
    expect(menuFinderCampaignId({ pages: [{ content_blocks: [{ type: 'hero' }] }] })).toBeNull();
    expect(menuFinderCampaignId({ pages: [{ content_blocks: [blk('')] }] })).toBeNull();
    expect(menuFinderCampaignId({ pages: [{ content_blocks: [blk(null)] }] })).toBeNull();
    expect(menuFinderCampaignId(null)).toBeNull();
  });
});
