// lib/creative/transcribe.ts
//
// Transcribe a take through the metered Whisper call (pricing row `openai:whisper:audio_stt`,
// ~$0.006/min) so every version shows what it SAYS beside what it sounds like — the claim
// wording ("supports…", never a drug effect) is checked by reading, and a reviewer on a phone
// may not play it. Never throws: a failure is reported as 'failed', never as an empty transcript.
import { meterLLMCall } from '@/lib/ai/meter';
import { getOpenAI } from '@/lib/ai/openaiClient';

const MAX_BYTES = 24 * 1024 * 1024; // Whisper's upload limit is 25 MB

export async function transcribeTakeUrl(url: string, opts: { userId?: string | null } = {}): Promise<{ ok: true; text: string; durationSec: number | null } | { ok: false; reason: string }> {
  try {
    const res = await fetch(url);
    if (!res.ok) return { ok: false, reason: `fetch ${res.status}` };
    const blob = await res.blob();
    if (blob.size > MAX_BYTES) return { ok: false, reason: 'too_large_for_whisper' };
    const ext = (url.split('?')[0].split('.').pop() || 'mp3').toLowerCase();
    const file = new File([blob], `take.${ext}`, { type: blob.type || 'audio/mpeg' });
    const r = await meterLLMCall<{ text: string; duration?: number }>(
      { provider: 'openai', model_code: 'whisper', modality: 'audio_stt', user_id: opts.userId ?? undefined },
      async () => {
        const out = (await getOpenAI('chat').audio.transcriptions.create({
          file,
          model: 'whisper-1',
          response_format: 'verbose_json',
          temperature: 0,
        })) as unknown as { text: string; duration?: number };
        return { value: out, usage: { minutes_audio: (out.duration ?? 0) / 60 } };
      },
    );
    return { ok: true, text: String(r.text ?? '').trim(), durationSec: typeof r.duration === 'number' ? r.duration : null };
  } catch (e: any) {
    return { ok: false, reason: e?.message || 'transcription_failed' };
  }
}
