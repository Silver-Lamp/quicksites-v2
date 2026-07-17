import { toPlainText, containsLinks, stripLinks } from '../sanitize';

describe('comment sanitize', () => {
  it('strips HTML markup (no injection reaches the DOM)', () => {
    expect(toPlainText('<script>alert(1)</script>hi')).toBe('alert(1)hi');
    expect(toPlainText('<b>bold</b> and <a href="x">link</a>')).toBe('bold and link');
  });
  it('caps length + collapses whitespace', () => {
    expect(toPlainText('a\r\n\n\n\nb   c')).toBe('a\n\nb c');
    expect(toPlainText('x'.repeat(5000), 100)).toHaveLength(100);
  });
  it('detects links, emails, bare domains', () => {
    expect(containsLinks('visit https://spam.ru now')).toBe(true);
    expect(containsLinks('email me at spam@x.com')).toBe(true);
    expect(containsLinks('go to cheappills.shop')).toBe(true);
    expect(containsLinks('great service, thanks!')).toBe(false);
  });
  it('strips links but keeps the readable comment', () => {
    expect(stripLinks('nice work see http://x.io/deal')).toBe('nice work see');
    expect(stripLinks('buy at scam.com now')).toBe('buy at now');
    // The invariant that matters: no link survives a strip.
    expect(containsLinks(stripLinks('buy at scam.com now'))).toBe(false);
  });
});
