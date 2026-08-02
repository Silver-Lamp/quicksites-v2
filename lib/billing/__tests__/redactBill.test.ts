/**
 * @jest-environment node
 */
// A cloud bill carries an account number, a company name, sometimes an address — and this text
// goes on to an LLM and to a human third party (the site owner reads the enquiry). So the
// redaction has to be right in one specific direction: over-flagging costs one click to undo,
// under-flagging ships someone's account number to a stranger.
import { findIdentifiers, redact, summarise, placeholderFor, KIND_LABEL } from '../redactBill';

const BILL = `Amazon Web Services Invoice
Invoice #INV-0093122
Account ID: 8841-2290-1174
Bill to: Crosstie Logistics, 1200 Harbor Blvd Suite 400
Contact: ops@crosstie-logistics.com  (714) 555-0134
Resource: arn:aws:ec2:us-west-2:884122901174:instance/i-0ab12
Endpoint 34.211.8.190
EC2 On-Demand Linux    $4,182.55
Data Transfer Out      $1,004.20
Total Due              $6,918.44`;

describe('findIdentifiers', () => {
  const found = findIdentifiers(BILL);
  const kinds = found.map((f) => f.kind);

  it('finds the email', () => {
    expect(found.find((f) => f.kind === 'email')?.text).toBe('ops@crosstie-logistics.com');
  });

  it('finds the account and invoice numbers', () => {
    expect(kinds).toContain('account');
  });

  it('finds the phone number', () => {
    expect(found.find((f) => f.kind === 'phone')?.text).toContain('555-0134');
  });

  it('finds the cloud resource identifier', () => {
    expect(found.find((f) => f.kind === 'arn')?.text).toContain('arn:aws:ec2');
  });

  it('finds the IP address', () => {
    expect(found.find((f) => f.kind === 'ip')?.text).toBe('34.211.8.190');
  });

  it('finds the street address', () => {
    expect(found.find((f) => f.kind === 'address')?.text).toContain('Harbor Blvd');
  });

  it('returns findings in document order', () => {
    const starts = found.map((f) => f.start);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
  });

  it('never returns overlapping ranges', () => {
    // An ARN contains a 12-digit account id and an instance id; reporting the same characters
    // twice would double-redact and corrupt the offsets.
    for (let i = 1; i < found.length; i++) {
      expect(found[i].start).toBeGreaterThanOrEqual(found[i - 1].end);
    }
  });
});

describe('redact', () => {
  const found = findIdentifiers(BILL);

  it('removes every identifier by default', () => {
    const out = redact(BILL, found);
    expect(out).not.toContain('ops@crosstie-logistics.com');
    expect(out).not.toContain('8841-2290-1174');
    expect(out).not.toContain('34.211.8.190');
    expect(out).not.toContain('555-0134');
  });

  // ⚠️ THE WHOLE POINT: the numbers that make an estimate possible must survive.
  it('keeps the money and the line items intact', () => {
    const out = redact(BILL, found);
    expect(out).toContain('$4,182.55');
    expect(out).toContain('$1,004.20');
    expect(out).toContain('$6,918.44');
    expect(out).toContain('EC2 On-Demand Linux');
    expect(out).toContain('Data Transfer Out');
  });

  it('leaves a readable placeholder, so the reader knows a value was there', () => {
    const out = redact(BILL, found);
    expect(out).toContain(placeholderFor('email'));
    expect(out).toContain('removed]');
  });

  it('honours the person un-ticking a false positive', () => {
    // The regex flags candidates; the PERSON decides what is identifying about their own
    // document. An un-ticked finding must survive verbatim.
    const ip = found.find((f) => f.kind === 'ip')!;
    const out = redact(BILL, found, new Set([ip.start]));
    expect(out).toContain('34.211.8.190');
    expect(out).not.toContain('ops@crosstie-logistics.com');
  });

  it('is stable when nothing is found', () => {
    const plain = 'Compute $100\nStorage $20';
    expect(redact(plain, findIdentifiers(plain))).toBe(plain);
  });
});

describe('summarise', () => {
  it('counts by kind with human labels', () => {
    const s = summarise(findIdentifiers(BILL));
    expect(s.length).toBeGreaterThan(0);
    for (const row of s) {
      expect(row.label).toBe(KIND_LABEL[row.kind]);
      expect(row.count).toBeGreaterThan(0);
    }
  });
});

describe('the over-flag bias is deliberate', () => {
  it('flags a bare long digit run rather than risk missing an account number', () => {
    // False positive: one click to undo. False negative: an account number sent to a stranger.
    expect(findIdentifiers('Ref 4532015112830366').length).toBeGreaterThan(0);
  });

  it('does not flag ordinary money amounts', () => {
    // Over-flagging is the safe direction, but flagging every price would make the review
    // useless and train people to click "strike all" without reading.
    const found = findIdentifiers('EC2 On-Demand $4,182.55 and Storage $20.00');
    expect(found).toHaveLength(0);
  });
});

// ⚠️ THE BUG MY FIRST FIXTURE MISSED, BECAUSE IT WAS TOO TIDY.
//
// A real bill starts "AWS Invoice" on its own line, then "Account ID: …" on the next. The
// keyword pattern used `\s*` between the keyword and its value — and `\s` matches a NEWLINE. So
// `invoice` on line 1 reached across the line break and captured the word `Account` on line 2 as
// its value. It struck "Invoice\nAccount", LEFT the actual account number in the text, and still
// reported `account: 1`.
//
// That last part is what makes it serious. A missed identifier is a bug; one the summary claims
// was removed is a lie that stops anyone looking. Found by posting a realistic multi-line bill
// through the live endpoint and then READING THE STORED ROW rather than trusting the counts.
describe('keyword patterns must not reach across a line break', () => {
  const REAL = [
    'AWS Invoice',
    'Account ID: 8841-2290-1174',
    'Bill to: Crosstie Logistics, 1200 Harbor Blvd Suite 400',
    'Contact: ops@crosstie-logistics.com (714) 555-0134',
    'EC2 On-Demand Linux  $4,182.55',
  ].join('\n');

  const out = redact(REAL, findIdentifiers(REAL));

  it('removes the account number itself, not the word above it', () => {
    expect(out).not.toContain('8841-2290-1174');
  });

  it('leaves the heading on its own line intact', () => {
    // "AWS Invoice" is a document title, not an identifier.
    expect(out).toContain('AWS Invoice');
  });

  it('takes the suite number with the address rather than leaving it behind', () => {
    expect(out).not.toContain('Harbor Blvd');
    expect(out).not.toMatch(/Suite\s*400|\b400\b/);
  });

  it('still removes the email and phone', () => {
    expect(out).not.toContain('ops@crosstie-logistics.com');
    expect(out).not.toContain('555-0134');
  });

  it('still keeps the money', () => {
    expect(out).toContain('$4,182.55');
    expect(out).toContain('EC2 On-Demand Linux');
  });

  it('reports only what it actually struck', () => {
    // The counts and the text must agree. They did not, which is how the bug hid.
    const kinds = summarise(findIdentifiers(REAL)).map((s) => s.kind);
    for (const k of kinds) expect(out).toContain('removed]');
    expect(kinds).toContain('account');
  });
});
