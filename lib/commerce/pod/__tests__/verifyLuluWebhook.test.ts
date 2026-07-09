// lib/commerce/pod/__tests__/verifyLuluWebhook.test.ts
import crypto from 'crypto';
import { verifyLuluWebhook } from '../lulu';

const BODY = Buffer.from(JSON.stringify({ data: { id: 'job_1', status: { name: 'SHIPPED' } } }));
const sign = (secret: string, body: Buffer) =>
  crypto.createHmac('sha256', secret).update(body).digest('base64');

describe('verifyLuluWebhook', () => {
  const origSecret = process.env.LULU_WEBHOOK_SECRET;
  const origEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (origSecret === undefined) delete process.env.LULU_WEBHOOK_SECRET;
    else process.env.LULU_WEBHOOK_SECRET = origSecret;
    (process.env as any).NODE_ENV = origEnv;
  });

  it('rejects unsigned webhooks in production when no secret is set (fail closed)', () => {
    delete process.env.LULU_WEBHOOK_SECRET;
    (process.env as any).NODE_ENV = 'production';
    expect(verifyLuluWebhook(BODY, undefined)).toBe(false);
    expect(verifyLuluWebhook(BODY, 'anything')).toBe(false);
  });

  it('accepts when no secret is set outside production (sandbox convenience)', () => {
    delete process.env.LULU_WEBHOOK_SECRET;
    (process.env as any).NODE_ENV = 'test';
    expect(verifyLuluWebhook(BODY, undefined)).toBe(true);
  });

  it('accepts a correctly signed body and rejects a bad/missing signature', () => {
    process.env.LULU_WEBHOOK_SECRET = 's3cr3t';
    (process.env as any).NODE_ENV = 'production';
    expect(verifyLuluWebhook(BODY, sign('s3cr3t', BODY))).toBe(true);
    expect(verifyLuluWebhook(BODY, sign('wrong', BODY))).toBe(false);
    expect(verifyLuluWebhook(BODY, undefined)).toBe(false);
  });
});
