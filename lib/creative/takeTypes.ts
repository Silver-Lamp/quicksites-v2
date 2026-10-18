// lib/creative/takeTypes.ts — which files a take may be, shared by the sign and register routes.
export const MAX_TAKE_BYTES = 60 * 1024 * 1024;

const BY_TYPE: Record<string, { ext: string; kind: 'audio' | 'video'; contentType: string }> = {
  'audio/wav': { ext: 'wav', kind: 'audio', contentType: 'audio/wav' },
  'audio/x-wav': { ext: 'wav', kind: 'audio', contentType: 'audio/wav' },
  'audio/wave': { ext: 'wav', kind: 'audio', contentType: 'audio/wav' },
  'audio/mpeg': { ext: 'mp3', kind: 'audio', contentType: 'audio/mpeg' },
  'audio/mp4': { ext: 'm4a', kind: 'audio', contentType: 'audio/mp4' },
  'audio/x-m4a': { ext: 'm4a', kind: 'audio', contentType: 'audio/mp4' },
  'video/mp4': { ext: 'mp4', kind: 'video', contentType: 'video/mp4' },
  'video/webm': { ext: 'webm', kind: 'video', contentType: 'video/webm' },
  'video/quicktime': { ext: 'mov', kind: 'video', contentType: 'video/quicktime' },
};
const BY_EXT: Record<string, string> = { wav: 'audio/wav', mp3: 'audio/mpeg', m4a: 'audio/mp4', mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime' };

/** From the browser's reported type, else the filename's extension (a WAV often arrives typeless). */
export function takeKindFor(contentType: string, filename: string): { ext: string; kind: 'audio' | 'video'; contentType: string } | null {
  const direct = BY_TYPE[String(contentType || '').toLowerCase()];
  if (direct) return direct;
  const ext = String(filename || '').toLowerCase().split('.').pop() || '';
  const viaExt = BY_EXT[ext];
  return viaExt ? BY_TYPE[viaExt] : null;
}
