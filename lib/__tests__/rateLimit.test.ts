// lib/__tests__/rateLimit.test.ts
import { clientIp } from '../rateLimit';

// jsdom lacks Request; clientIp only reads req.headers.get(...), so a Headers stub suffices.
const reqWith = (headers: Record<string, string>) => ({ headers: new Headers(headers) } as unknown as Request);

describe('clientIp', () => {
  it('takes the first entry of x-forwarded-for', () => {
    expect(clientIp(reqWith({ 'x-forwarded-for': '203.0.113.5, 10.0.0.1' }))).toBe('203.0.113.5');
  });

  it('trims whitespace around the client ip', () => {
    expect(clientIp(reqWith({ 'x-forwarded-for': '  203.0.113.9 ,10.0.0.1' }))).toBe('203.0.113.9');
  });

  it('falls back to x-real-ip, then cf-connecting-ip', () => {
    expect(clientIp(reqWith({ 'x-real-ip': '198.51.100.2' }))).toBe('198.51.100.2');
    expect(clientIp(reqWith({ 'cf-connecting-ip': '198.51.100.7' }))).toBe('198.51.100.7');
  });

  it('returns "unknown" when no ip headers are present', () => {
    expect(clientIp(reqWith({}))).toBe('unknown');
  });
});
