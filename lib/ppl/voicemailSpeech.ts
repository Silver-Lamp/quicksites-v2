// lib/ppl/voicemailSpeech.ts
//
// Did a person actually speak on this voicemail?
//
// ⚠️ THE CASE THAT BUILT THIS. 2026-10-07 04:29: a fax machine dialled covingtontow.com, got the
// voicemail greeting, and left 21 seconds of CNG tone (0.5 s beep, 3 s silence, six times). The
// operator email read "New lead … Relay it to a local business", because all it knew was that a
// recording existed. Whisper heard "🎵🎵🎵"; a second pass with a leading prompt echoed the
// prompt back four times, which is what it does when there is nothing to transcribe. Both are
// recognisable, and `classifyVoicemailSpeech` is pure so both are pinned.
//
// ⚠️ The classifier says SPEECH / NO SPEECH / UNKNOWN. It never summarises or judges the message;
// the transcript is shown to the operator as the caller said it. 'unknown' (fetch or model
// failure) must read as "listen yourself", never as "nothing there".
import { meterLLMCall } from '@/lib/ai/meter';
import { getOpenAI } from '@/lib/ai/openaiClient';

export type VoicemailSpeech = 'speech' | 'no_speech' | 'unknown';

export type WhisperSegment = { text: string; no_speech_prob?: number | null };

/** Glyphs and bracketed tags Whisper emits for music or noise instead of words. */
const NON_SPEECH = /[\u{1F3B5}\u{1F3B6}♪♫]|\[(music|applause|noise|silence|inaudible)[^\]]*\]|\((music|applause|noise|silence|inaudible)[^)]*\)/giu;

/** Pure. Decide from the transcript text and Whisper's per-segment confidence. */
export function classifyVoicemailSpeech(input: {
  text: string | null | undefined;
  segments?: WhisperSegment[] | null;
  durationSec?: number | null;
}): VoicemailSpeech {
  const cleaned = (input.text ?? '').replace(NON_SPEECH, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'no_speech';
  const segs = (input.segments ?? []).filter((s) => (s.text ?? '').trim());
  if (segs.length) {
    const probs = segs.map((s) => (typeof s.no_speech_prob === 'number' ? s.no_speech_prob : 0));
    const avg = probs.reduce((a, b) => a + b, 0) / probs.length;
    if (avg > 0.6) return 'no_speech';
    // The same sentence repeated for every segment is the model filling silence, not a caller.
    const distinct = new Set(segs.map((s) => s.text.trim().toLowerCase()));
    if (segs.length >= 3 && distinct.size === 1) return 'no_speech';
  }
  return 'speech';
}

export type VoicemailTranscription = {
  speech: VoicemailSpeech;
  transcript: string | null;
  durationSec: number | null;
};

async function fetchRecordingMp3(recordingUrl: string): Promise<Blob | null> {
  const sid = process.env.TWILIO_ACCOUNT_SID || '';
  const auth = process.env.TWILIO_AUTH_TOKEN || '';
  if (!sid || !auth) return null;
  const headers = { Authorization: `Basic ${Buffer.from(`${sid}:${auth}`).toString('base64')}` };
  // Twilio can answer 404 for a second or two after the action callback while the file lands.
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`${recordingUrl}.mp3`, { headers }).catch(() => null);
    if (res?.ok) return await res.blob();
    await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
  }
  return null;
}

/**
 * Transcribe a Twilio voicemail through the metered OpenAI wrapper (pricing row
 * `openai:whisper:audio_stt`) and classify it. Never throws: a failure is 'unknown'.
 */
export async function transcribeVoicemail(recordingUrl: string, meta: { callSid: string; userId?: string | null } = { callSid: '' }): Promise<VoicemailTranscription> {
  try {
    const blob = await fetchRecordingMp3(recordingUrl);
    if (!blob) return { speech: 'unknown', transcript: null, durationSec: null };
    const file = new File([blob], `${meta.callSid || 'voicemail'}.mp3`, { type: 'audio/mpeg' });
    const result = await meterLLMCall<{ text: string; duration?: number; segments?: WhisperSegment[] }>(
      { provider: 'openai', model_code: 'whisper', modality: 'audio_stt', user_id: meta.userId ?? undefined },
      async () => {
        const r = (await getOpenAI('chat').audio.transcriptions.create({
          file,
          model: 'whisper-1',
          // No leading prompt: a prompt is what Whisper echoes back when there is no speech.
          response_format: 'verbose_json',
          temperature: 0,
        })) as unknown as { text: string; duration?: number; segments?: WhisperSegment[] };
        return { value: r, usage: { minutes_audio: (r.duration ?? 0) / 60 } };
      },
    );
    const speech = classifyVoicemailSpeech({ text: result.text, segments: result.segments, durationSec: result.duration });
    return { speech, transcript: speech === 'speech' ? result.text.trim() : null, durationSec: result.duration ?? null };
  } catch {
    return { speech: 'unknown', transcript: null, durationSec: null };
  }
}
