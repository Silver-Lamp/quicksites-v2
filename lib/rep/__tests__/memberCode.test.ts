import { codeBaseFor } from '@/lib/rep/memberCode';

describe('codeBaseFor — a member code comes from the email, never from a typed value', () => {
  it('uses the local part, dropping a +alias', () => {
    expect(codeBaseFor('sandon+tester2@gmail.com', 'fbde34ec-0000')).toBe('sandon');
    expect(codeBaseFor('Abdou.K@example.com', 'x')).toBe('abdou-k');
  });
  it('falls back to the user id when the local part is too short or missing', () => {
    expect(codeBaseFor('ab@x.com', 'fbde34ec-1111-2222')).toBe('rep-fbde34ec');
    expect(codeBaseFor(null, 'fbde34ec-1111-2222')).toBe('rep-fbde34ec');
  });
});
