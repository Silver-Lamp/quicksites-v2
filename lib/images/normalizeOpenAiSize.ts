// lib/images/normalizeOpenAiSize.ts
export type OpenAISize = '1024x1024' | '1024x1536' | '1536x1024' | 'auto';


/** Map any legacy/invalid size into one of the allowed OpenAI sizes. */
export function normalizeOpenAiSize(input?: string | number | null, aspect?: string): OpenAISize {
const raw = (input ?? '').toString().trim().toLowerCase();
if (raw === '1024x1024' || raw === '1024x1536' || raw === '1536x1024' || raw === 'auto') return raw as OpenAISize;


// Common legacy values → square 1024
if (raw === '512x512' || raw === '256x256' || raw === 'square' || raw === '1:1' || raw === '512' || raw === '256') {
return '1024x1024';
}
// Aspect hints
const a = (aspect || '').toLowerCase();
if (a === 'portrait' || raw === '2:3' || raw === '9:16') return '1024x1536';
if (a === 'landscape' || raw === '16:9' || raw === '3:2') return '1536x1024';
// Avatar/square/default
return '1024x1024';
}