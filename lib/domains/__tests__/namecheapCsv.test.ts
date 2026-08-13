/**
 * @jest-environment node
 */
// Parsing the Namecheap Domain List export.
//
// The why-null-not-a-guess reasoning lives in lib/domains/namecheapCsv.ts.
import { parseCsv, parseNamecheapDate } from '../namecheapCsv';

describe('parseNamecheapDate', () => {
  it('parses the export format', () => {
    expect(parseNamecheapDate('Jul 11 2027')).toBe('2027-07-11T00:00:00+00:00');
    expect(parseNamecheapDate('Apr 08 2027')).toBe('2027-04-08T00:00:00+00:00');
  });

  it('handles a single-digit day', () => {
    expect(parseNamecheapDate('Jun 6 2027')).toBe('2027-06-06T00:00:00+00:00');
  });

  it('is month-name driven, not positional', () => {
    expect(parseNamecheapDate('Dec 20 2027')).toBe('2027-12-20T00:00:00+00:00');
    expect(parseNamecheapDate('Jan 01 2026')).toBe('2026-01-01T00:00:00+00:00');
  });

  // ⚠️ Returns null, never a Date it invented. An unparseable cell must degrade to "unknown expiry"
  // — which the projection already handles — rather than to a confident wrong month.
  it('refuses anything it does not recognise', () => {
    for (const bad of ['', '2027-07-11', 'Jul 2027', 'Foo 11 2027', 'Jul 11', 'n/a']) {
      expect(parseNamecheapDate(bad)).toBeNull();
    }
  });
});

describe('parseCsv', () => {
  const csv = [
    'Domain Name,Domain privacy protection status,Domain status at NC,Domain auto-renew status,Domain expiration date',
    'renton-restaurant.com,ON,Active,ON,Jul 11 2027',
    'EXAMPLE.COM,ON,Active,OFF,Sep 20 2026',
    '',
  ].join('\n');

  it('reads domain, auto-renew and expiry', () => {
    const rows = parseCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      domain: 'renton-restaurant.com',
      status: 'Active',
      autoRenew: true,
      expiresAt: '2027-07-11T00:00:00+00:00',
    });
  });

  it('lowercases the domain so it matches the ledger key', () => {
    expect(parseCsv(csv)[1].domain).toBe('example.com');
  });

  it('reads auto-renew OFF as false — the row that actually costs money if missed', () => {
    expect(parseCsv(csv)[1].autoRenew).toBe(false);
  });

  it('skips the header and any trailing blank line', () => {
    expect(parseCsv(csv).map((r) => r.domain)).not.toContain('domain name');
  });
});
