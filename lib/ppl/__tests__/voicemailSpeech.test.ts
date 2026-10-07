/**
 * @jest-environment node
 */
// lib/ppl/__tests__/voicemailSpeech.test.ts
//
// "Did a person speak?" — pinned on the real fax-tone voicemail of 2026-10-07 and on Whisper's
// two failure shapes (music glyphs; a prompt echoed back), plus guards over the surfaces that
// change their wording on the answer.
import fs from 'node:fs';
import path from 'node:path';
import { classifyVoicemailSpeech } from '@/lib/ppl/voicemailSpeech';
import { handlingLabel, type CallRow } from '@/lib/ppl/callAlert';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const strip = (s: string) => s.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

describe('classifyVoicemailSpeech', () => {
  it('the fax: Whisper heard only music glyphs', () => {
    expect(classifyVoicemailSpeech({ text: '🎵🎵🎵', segments: [{ text: '🎵🎵🎵', no_speech_prob: 0.9 }] })).toBe('no_speech');
    expect(classifyVoicemailSpeech({ text: '[Music]' })).toBe('no_speech');
    expect(classifyVoicemailSpeech({ text: '' })).toBe('no_speech');
  });

  it('the prompt echoed back four times is the model filling silence', () => {
    const line = 'The caller says their name, phone number and where they are.';
    expect(classifyVoicemailSpeech({ text: `${line} ${line} ${line} ${line}`, segments: [1, 2, 3, 4].map(() => ({ text: line, no_speech_prob: 0.12 })) })).toBe('no_speech');
  });

  it('a real message is speech, even a short one', () => {
    expect(classifyVoicemailSpeech({ text: 'Hi, my car broke down on 167 near the Kent exit, call me back.', segments: [{ text: 'Hi, my car broke down on 167 near the Kent exit, call me back.', no_speech_prob: 0.05 }] })).toBe('speech');
    expect(classifyVoicemailSpeech({ text: 'Hello?' })).toBe('speech');
  });

  it('mostly-silent segments outvote a stray word', () => {
    expect(classifyVoicemailSpeech({ text: 'uh', segments: [{ text: 'uh', no_speech_prob: 0.95 }] })).toBe('no_speech');
  });
});

describe('the notifications change their ask on the answer', () => {
  it('the operator email never says "Relay it" for a no-speech voicemail, and never calls unknown "nothing"', () => {
    const src = strip(read('lib/ppl/voicemail.ts'));
    expect(src).toMatch(/noSpeech\s*\?[\s\S]*Nothing to relay/);
    expect(src).toMatch(/Relay it to a local business/);
    expect(src).toMatch(/const noSpeech = opts\.hasRecording && speech === 'no_speech'/);
  });

  it('the business is not texted about a fax tone', () => {
    const route = strip(read('app/api/twilio/geo/[campaignId]/voicemail/route.ts'));
    expect(route).toMatch(/if \(speech === 'no_speech'\)[\s\S]*skipped: 'no_speech'/);
  });

  it('Twilio is answered before any transcription runs', () => {
    const route = strip(read('app/api/twilio/geo/[campaignId]/voicemail/route.ts'));
    expect(route).toMatch(/import \{ after \} from 'next\/server'/);
    const afterAt = route.indexOf('after(async () => {');
    const transcribeAt = route.indexOf('transcribeVoicemail(');
    expect(afterAt).toBeGreaterThan(0);
    expect(transcribeAt).toBeGreaterThan(afterAt);
  });

  it('the transcription is metered under the pricing row that exists (openai:whisper:audio_stt)', () => {
    const src = strip(read('lib/ppl/voicemailSpeech.ts'));
    expect(src).toMatch(/model_code: 'whisper', modality: 'audio_stt'/);
    expect(src).toMatch(/meterLLMCall/);
  });

  it('the call-alert digest says what the voicemail contained', () => {
    const base = { id: '1', call_sid: 'CA1', from_number: '+12535550123', to_number: null, forwarded_to: null, call_status: 'ended', call_duration: 35, handling: 'voicemail_first', custom_domain: 'x.com', created_at: '2026-10-07T11:29:00Z' } as CallRow;
    expect(handlingLabel({ ...base, voicemail_speech: 'no_speech' })).toMatch(/no speech on the recording/);
    expect(handlingLabel({ ...base, voicemail_speech: 'speech', voicemail_transcript: 'Car broke down on 167.' })).toMatch(/they said: "Car broke down on 167\."/);
    expect(handlingLabel(base)).toBe('Sent to voicemail (voicemail-first is on for this number)');
    expect(read('app/api/cron/call-alert/route.ts')).toMatch(/voicemail_speech, voicemail_transcript/);
  });
});
