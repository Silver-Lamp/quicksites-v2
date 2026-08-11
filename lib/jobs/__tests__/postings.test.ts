import { rehearsalLinkFor, validatePosting } from '../postings';

describe('validatePosting', () => {
  it('accepts a link alone or pasted text alone', () => {
    expect(validatePosting({ url: 'https://example.com/job/1' })).toBeNull();
    expect(validatePosting({ body: 'Senior Engineer. You will…' })).toBeNull();
  });

  it('rejects a posting that records nothing', () => {
    expect(validatePosting({})).toMatch(/paste/i);
    expect(validatePosting({ company: 'Acme', title: 'Engineer' })).toMatch(/paste/i);
    expect(validatePosting({ url: '   ', body: '  ' })).toMatch(/paste/i);
  });

  it('rejects a link that is not one', () => {
    expect(validatePosting({ url: 'example.com/job' })).toMatch(/http/i);
  });
});

describe('rehearsalLinkFor', () => {
  // ⚠️ THE LOAD-BEARING TEST. A job description in a query string is copied into browser history,
  // any referrer header, and the receiving server's access logs — three copies of a private
  // document created purely by the convenience of prefilling it.
  it('never puts the posting body or notes in the URL', () => {
    const link = rehearsalLinkFor({
      company: 'Acme',
      title: 'Staff Engineer',
      stage: 'hiring_manager',
    } as any);
    expect(link).not.toContain('body');
    expect(link).not.toContain('notes');
  });

  it('carries only company, role and stage', () => {
    const link = rehearsalLinkFor({ company: 'Acme', title: 'Staff Engineer', stage: 'technical' });
    expect(link).toContain('company=Acme');
    expect(link).toContain('role=Staff+Engineer');
    expect(link).toContain('stage=technical');
  });

  it('omits what the user has not filled in rather than sending blanks', () => {
    expect(rehearsalLinkFor({ company: null, title: null, stage: null })).toBe(
      'https://www.hivejournal.com/rehearsal-room/interview',
    );
    const partial = rehearsalLinkFor({ company: 'Acme', title: null, stage: null });
    expect(partial).toContain('company=Acme');
    expect(partial).not.toContain('role=');
  });

  it('encodes values so a company with an ampersand does not truncate the link', () => {
    const link = rehearsalLinkFor({ company: 'Ben & Jerry', title: null, stage: null });
    expect(link).toContain('%26');
    expect(link).not.toMatch(/company=Ben & Jerry/);
  });
});
