/**
 * @jest-environment node
 */
// A contact the scaffold invented must never be listed as a person's. The 2026-09-13 scan "found"
// hello@<slug>.com on 9 of 16 guest sites — all ours.
import { readFileSync } from 'node:fs';
import { classifyLead, contactOnRecord, extractContactsFromText, isPlaceholderEmail, placeholderEmailFor, lookupQueryFor, lookupWorthTrying, assessLookup } from '../guestContacts';

describe('placeholder emails', () => {
  it('matches exactly what autogenerateForTemplate invents', () => {
    expect(placeholderEmailFor('Adze Media')).toBe('hello@adze-media.com');
    expect(placeholderEmailFor("Khetia\"s GigaBite Restaurant KTL")).toBe('hello@khetia-s-gigabite-restaurant-ktl.com');
    expect(placeholderEmailFor('')).toBe('hello@your-business.com');
  });
  it('flags the scaffold placeholder, a generic example, and an empty value; keeps a real address', () => {
    expect(isPlaceholderEmail('hello@adze-media.com', 'Adze Media')).toBe(true);
    expect(isPlaceholderEmail('hello@adzemedia.com', 'Adze Media')).toBe(true); // slug drift after a rename
    expect(isPlaceholderEmail('you@example.com', 'Adze Media')).toBe(true);
    expect(isPlaceholderEmail('', 'Adze Media')).toBe(true);
    expect(isPlaceholderEmail('sam@adzemedia.com', 'Adze Media')).toBe(false);
    expect(isPlaceholderEmail('hello@adzemedia.com', 'Ferry Street Towing')).toBe(false); // hello@ for a DIFFERENT business is theirs
  });
  it('the source-of-truth string in autogenerateForTemplate has not drifted from placeholderEmailFor', () => {
    const src = readFileSync('lib/builder/autogenerateForTemplate.ts', 'utf8');
    expect(src).toMatch(/`hello@\$\{\(businessName \|\| 'your-business'\)\.toLowerCase\(\)\.replace\(\/\[\^a-z0-9\]\+\/g, '-'\)\.replace\(\/\(\^-\|-\$\)\/g, ''\)\.slice\(0, 40\) \|\| 'your-business'\}\.com`/);
  });
});

describe('extractContactsFromText', () => {
  it('pulls emails and phones out of a page, drops placeholders, image names and 555 numbers', () => {
    const text = 'Call (209) 961-5328 or 555-0123. Write sam@wspaving.com or hello@ws-paving.com. logo@2x.png';
    expect(extractContactsFromText(text, 'WS Paving')).toEqual({ emails: ['sam@wspaving.com'], phones: ['(209) 961-5328'] });
  });
  it('de-dupes', () => {
    expect(extractContactsFromText('a@b.co a@b.co A@B.CO', null).emails).toEqual(['a@b.co']);
  });
  it('⚠️ a coordinate, a timestamp, or a bare digit run is not a phone — the first scan listed all three', () => {
    const page = 'lat 47.4797732 lng -122.3150847 · id 1764292869 · photo 3673636194 · ref 0983191319 · call 206-774-9444 or +12067749444 or (425) 271.1817';
    expect(extractContactsFromText(page, null).phones).toEqual(['206-774-9444', '+12067749444', '(425) 271.1817']);
  });
});

describe('contactOnRecord + classifyLead', () => {
  const data = { meta: { rebuilt_from: 'https://adzemedia.com/', contact: { email: 'hello@adzemedia.com', phone: '(645) 228-6949', address: 'South Florida' } } };
  it('a typed phone field that is not a number is no phone — "Not provided" made a lead "reachable" on the first scan', () => {
    expect(contactOnRecord({ meta: { contact: { phone: 'Not provided' } } }, 'Meddzelle').phone).toBeNull();
    expect(contactOnRecord({ meta: { contact: { phone: 'call 206-774-9444 anytime' } } }, 'X').phone).toBe('206-774-9444');
  });
  it('reads meta.contact and meta.rebuilt_from, and flags the placeholder', () => {
    expect(contactOnRecord(data, 'Adze Media')).toEqual({ email: 'hello@adzemedia.com', emailIsPlaceholder: true, phone: '(645) 228-6949', address: 'South Florida', sourceUrl: 'https://adzemedia.com/' });
  });
  it('best channel: a real email beats a phone beats the website; a placeholder email never counts', () => {
    const base = { templateId: 't', slug: 's', businessName: 'Adze Media', createdAt: '2026-09-13T10:00:00Z', updatedAt: '2026-09-13T10:12:00Z' };
    const onRecord = contactOnRecord(data, 'Adze Media');
    expect(classifyLead({ ...base, onRecord, scraped: null }).bestChannel).toBe('phone');
    expect(classifyLead({ ...base, onRecord, scraped: { emails: ['sam@adzemedia.com'], phones: [], fetched: true } }).bestChannel).toBe('email');
    expect(classifyLead({ ...base, onRecord: { ...onRecord, phone: null }, scraped: null }).bestChannel).toBe('website');
    const nothing = classifyLead({ ...base, onRecord: contactOnRecord({}, 'pepe'), scraped: null });
    expect(nothing).toMatchObject({ bestChannel: null, reachable: false, minutesEdited: 12 });
  });
});

describe('business-name lookup — a candidate to confirm, never an answer', () => {
  const sim = (a: string, b: string) => (a.toLowerCase() === b.toLowerCase() ? 1 : a.toLowerCase().split(' ')[0] === b.toLowerCase().split(' ')[0] ? 0.7 : 0.2);
  it('refuses to look up a name with nothing distinctive in it', () => {
    for (const n of ['pepe', 'real estate', 'Smoothie Shop', 'quicksites', 'The Store']) expect(lookupWorthTrying(n)).toBe(false);
    for (const n of ['Adze Media', "Jay Berry's Cafe", 'Guardian Towing Renton', 'Poignant Photography']) expect(lookupWorthTrying(n)).toBe(true);
    expect(lookupWorthTrying('pepe', { address: 'South Florida' })).toBe(true); // a locality rescues a thin name
  });
  it('the query carries the locality the site recorded', () => {
    expect(lookupQueryFor('Adze Media', { address: 'South Florida' })).toBe('Adze Media, South Florida');
    expect(lookupQueryFor('Adze Media')).toBe('Adze Media');
  });
  it('shows a strong name match, hides a weak one, and never claims more than "confirm"', () => {
    const cand = { placeId: 'p', name: 'Adze Media', address: '1 Main St, Miami, FL 33101, USA', phone: null, website: null };
    expect(assessLookup('Adze Media', cand, sim)).toEqual({ show: true, score: 1, note: null });
    expect(assessLookup('Adze Media', { ...cand, name: 'Bolt Plumbing' }, sim)).toMatchObject({ show: false, reason: 'name_differs' });
    expect(assessLookup('Adze Media', null, sim)).toMatchObject({ show: false, reason: 'no_match' });
    expect(assessLookup('pepe', cand, sim)).toMatchObject({ show: false, reason: 'not_worth_trying' });
  });
  it('notes when the result is somewhere other than the locality the site recorded', () => {
    const cand = { placeId: 'p', name: 'Adze Media', address: '9 High St, Portland, OR 97201, USA', phone: null, website: null };
    const v = assessLookup('Adze Media', cand, sim, { address: 'South Florida' });
    expect(v.show).toBe(true);
    if (v.show) expect(v.note).toMatch(/South Florida.*elsewhere/);
  });
  it('a lookup candidate never makes a lead "reachable" or sets its channel', () => {
    const base = { templateId: 't', slug: 's', businessName: 'Adze Media', createdAt: '2026-09-13T10:00:00Z', updatedAt: '2026-09-13T10:00:00Z', onRecord: contactOnRecord({}, 'Adze Media'), scraped: null };
    const lead = classifyLead({ ...base, lookup: { query: 'Adze Media', candidate: { placeId: 'p', name: 'Adze Media', address: '1 Main St', phone: '305-555-0100', website: null }, verdict: { show: true, score: 1, note: null } } });
    expect(lead).toMatchObject({ reachable: false, bestChannel: null });
    expect(lead.lookup?.verdict.show).toBe(true);
  });
});

describe('the script finds people and never writes to them', () => {
  const src = readFileSync('scripts/guest-contacts.ts', 'utf8');
  it('states the rule and carries no message text', () => {
    expect(src).toMatch(/IT FINDS PEOPLE\. IT DOES NOT WRITE MESSAGES/);
    expect(src).not.toMatch(/sendSms|sendEmail|resend|twilio/i);
  });
});
