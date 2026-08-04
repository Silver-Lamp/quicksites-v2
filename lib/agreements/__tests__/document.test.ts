import { canonicalize, documentHash, verifyDocument, shortHash } from '../document';
import { mintSignToken, verifySignToken, SIGN_TOKEN_TTL_MS } from '../signToken';
import { agreementCertificateHtml, formatSignedAt } from '../certificate';

const BODY = 'This is the agreement.\n\nSection 1. You agree.\n';

describe('canonicalize', () => {
  it('treats a Windows paste as the same document', () => {
    expect(documentHash('a\r\nb')).toBe(documentHash('a\nb'));
  });

  it('ignores trailing whitespace and trailing newlines', () => {
    expect(documentHash('a  \nb\t\n\n\n')).toBe(documentHash('a\nb\n'));
  });

  it('normalises unicode composition, so an "é" typed two ways is one document', () => {
    expect(documentHash('café')).toBe(documentHash('café'));
  });

  it('does NOT change meaning — case, wording and internal spacing are preserved', () => {
    // The bar for any transform in canonicalize(): it must be reversible in meaning. If one of
    // these ever collapses, two different agreements hash the same and the fingerprint is a lie.
    expect(documentHash('You agree')).not.toBe(documentHash('you agree'));
    expect(documentHash('You agree')).not.toBe(documentHash('You do not agree'));
    expect(documentHash('a b')).not.toBe(documentHash('a  b'));
    expect(canonicalize('You Agree')).toBe('You Agree');
  });

  it('is stable across calls', () => {
    expect(documentHash(BODY)).toBe(documentHash(BODY));
    expect(documentHash(BODY)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('verifyDocument', () => {
  const hash = documentHash(BODY);

  it('matches the text it was taken over', () => {
    expect(verifyDocument(BODY, hash)).toBe('match');
  });

  it('detects a single changed character', () => {
    expect(verifyDocument('This is the agreement.\n\nSection 1. You agree!\n', hash)).toBe('altered');
  });

  it('distinguishes "no hash to check" from "intact" — the whole point of a verdict', () => {
    // A boolean would report an unverifiable record as tampered, or worse, as fine.
    expect(verifyDocument(BODY, null)).toBe('unverifiable');
    expect(verifyDocument(BODY, '')).toBe('unverifiable');
  });
});

describe('signToken', () => {
  const OLD = process.env.AGREEMENT_TOKEN_SECRET;
  beforeAll(() => {
    process.env.AGREEMENT_TOKEN_SECRET = 'test-secret-for-agreements';
  });
  afterAll(() => {
    process.env.AGREEMENT_TOKEN_SECRET = OLD;
  });

  it('round-trips one agreement id', () => {
    const t = mintSignToken('abc-123');
    expect(verifySignToken(t)).toEqual({ agreementId: 'abc-123' });
  });

  it('rejects a tampered payload', () => {
    const t = mintSignToken('abc-123');
    const [body, mac] = t.split('.');
    const evil = Buffer.from(JSON.stringify({ a: 'other', exp: Date.now() + 1000 })).toString(
      'base64url',
    );
    expect(verifySignToken(`${evil}.${mac}`)).toBeNull();
    expect(verifySignToken(`${body}.${'x'.repeat(mac.length)}`)).toBeNull();
  });

  it('rejects an expired token', () => {
    const t = mintSignToken('abc-123', Date.now() - SIGN_TOKEN_TTL_MS - 1000);
    expect(verifySignToken(t)).toBeNull();
  });

  it('never throws on malformed input — a bad link is an ordinary case', () => {
    for (const bad of ['', 'nonsense', 'a.b.c', '.', 'x.']) {
      expect(verifySignToken(bad)).toBeNull();
    }
  });
});

describe('agreementCertificateHtml', () => {
  const cert = () =>
    agreementCertificateHtml({
      title: 'Volunteer Contributor Agreement',
      bodyText: BODY,
      documentSha256: documentHash(BODY),
      partyName: 'Point Seven Studio LLC',
      partyEmail: 'sandon@pointsevenstudio.com',
      signerName: 'Eiji Kimura',
      signerEmail: 'eiji@example.com',
      typedName: 'Eiji Kimura',
      signedAtIso: '2026-08-04T16:31:00.000Z',
      signerIp: '203.0.113.9',
      userAgent: 'Mozilla/5.0',
    });

  it('is self-contained — it has to open from a USB stick in ten years', () => {
    const html = cert();
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/<link[^>]+rel=["']?stylesheet/i);
    expect(html).not.toMatch(/<img/i);
    expect(html).not.toMatch(/@import|https?:\/\/[^"']*\.(css|js|woff2?)/i);
  });

  it('carries the full fingerprint and the document text', () => {
    const html = cert();
    expect(html).toContain(documentHash(BODY));
    expect(html).toContain('Section 1. You agree.');
  });

  it('states the limits and claims nothing it cannot support', () => {
    const html = cert();
    expect(html).toContain('not identity verification and not notarisation');
    // The words that would turn an honest record into a false one.
    expect(html).not.toMatch(/legally binding|certified|notari[sz]ed by|court-admissible/i);
  });

  it('escapes everything interpolated', () => {
    const html = agreementCertificateHtml({
      title: '<script>x</script>',
      bodyText: 'a & b',
      documentSha256: 'abc',
      partyName: 'P',
      signerName: 'S',
      signerEmail: 's@example.com',
      typedName: '"><b>',
      signedAtIso: '2026-08-04T00:00:00.000Z',
    });
    expect(html).not.toContain('<script>x</script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('a &amp; b');
  });

  it('timestamps in UTC — a time with no zone is not evidence', () => {
    expect(formatSignedAt('2026-08-04T16:31:00.000Z')).toBe('4 August 2026 at 16:31 UTC');
  });
});

describe('shortHash', () => {
  it('is a prefix of the full hash, uppercased for reading aloud', () => {
    const h = documentHash(BODY);
    expect(shortHash(h)).toBe(h.slice(0, 8).toUpperCase());
  });
});
