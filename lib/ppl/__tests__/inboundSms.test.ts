// lib/ppl/__tests__/inboundSms.test.ts — a business texting our number back never vanishes.
import fs from 'node:fs';
import path from 'node:path';
import { replyNextMove } from '@/lib/ppl/inboundSms';

const ROOT = path.resolve(__dirname, '../../..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');

describe('the next move under a reply', () => {
  const c = { id: 'c', domain: 'richland-towing.com', forward_to_name: "Ken's Auto Rescue", pitch_texted_at: '2026-10-18T23:47:00Z', pitch_followup_at: null, pitch_deal: 'next', pitch_result: null };
  it('a reply to the pitch says call now and where the link is; a stranger says so; a paying account is a customer', () => {
    expect(replyNextMove(c, 'reply')).toMatch(/replying to the pitch.*Call them now/);
    expect(replyNextMove({ ...c, pitch_followup_at: 'x' }, 'reply')).toMatch(/after the follow-up/);
    expect(replyNextMove(null, 'reply')).toMatch(/not the forward-to of any campaign/);
    expect(replyNextMove({ ...c, pitch_result: 'paid' }, 'reply')).toMatch(/paying account/);
    expect(replyNextMove({ ...c, pitch_texted_at: null }, 'reply')).toMatch(/No pitch has gone/);
    expect(replyNextMove(c, 'stop')).toMatch(/opted out/);
  });
});

describe('source guards — every OUTBOUND text is recorded and emailed from the one sender', () => {
  const src = read('lib/sms/sendSms.ts');
  it('logs after Twilio answers, fire-and-forget, never touching the result', () => {
    expect(src.indexOf('client.messages.create')).toBeLessThan(src.indexOf('logOutboundSms('));
    expect(src).toMatch(/void logOutboundSms\(/);
    expect(src).toMatch(/return result;/);
    const log = read('lib/sms/smsLog.ts');
    expect(log).toMatch(/from\('sms_messages'\)/);
    expect(log).toMatch(/direction: 'out'/);
    expect(log).toMatch(/Text sent/);
    expect(log).not.toMatch(/from '@\/lib\/ppl\/(?!automationStatus)/); // no cycle back into the senders
  });
  it('the pitch sends, the survey and the operator text name their reason', () => {
    expect(read('lib/ppl/pitchSend.ts')).toMatch(/reason: 'pitch_text1'/);
    expect(read('app/api/cron/ppl-outcome-survey/route.ts')).toMatch(/reason: 'outcome_survey'/);
    expect(read('app/api/admin/ppl/text-business/route.ts')).toMatch(/reason: 'operator_text'/);
  });
});

describe('source guards — the inbound route', () => {
  const src = read('app/api/twilio/sms/inbound/route.ts');
  it('answers Twilio first and records + emails every kind of inbound text in after()', () => {
    expect(src.match(/after\(async/g)?.length).toBeGreaterThanOrEqual(4); // stop, start, outcome, reply
    expect(src).toMatch(/kind: 'reply'/);
    expect(src).toMatch(/emailInboundReply\(id, \{ from, body, kind: 'reply'/);
  });
  it('never auto-replies to a human reply — the only <Message> responses are STOP confirmation and the survey ack', () => {
    const messages = src.match(/<Message>\$\{[^}]+\}<\/Message>/g) ?? [];
    expect(messages.every((m) => /stopConfirmationText|outcomeReplyAck/.test(m))).toBe(true);
    expect(messages.length).toBe(2);
  });
  it('the inbound table is service-role only and the pitch tab shows replies', () => {
    const mig = read('supabase/migrations/20260898_inbound_sms.sql');
    expect(mig).toMatch(/enable row level security/);
    expect(mig).not.toMatch(/create policy/);
    expect(read('supabase/migrations/20260899_sms_messages.sql')).toMatch(/rename to sms_messages/);
    expect(read('app/api/admin/ppl/pitch/route.ts')).toMatch(/recentMessagesForCampaign/);
    expect(read('components/admin/ppl-pitch-call-tool.tsx')).toMatch(/The text thread/);
  });
});
