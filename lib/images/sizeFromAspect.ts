// /lib/images/sizeFromAspect.ts
export type Aspect = 'square' | 'portrait' | 'landscape' | 'avatar' | 'auto' | string;


/**
* OpenAI images (gpt-image-1) now only accepts:
* - 1024x1024, 1024x1536, 1536x1024, or 'auto'.
* We default avatars/square to 1024x1024 and map known aspects.
*/
export function sizeFromAspect(aspect?: Aspect): '1024x1024' | '1024x1536' | '1536x1024' | 'auto' {
const a = (aspect || '').toLowerCase();
if (a === 'portrait') return '1024x1536';
if (a === 'landscape') return '1536x1024';
if (a === 'auto') return 'auto';
// 'square' | 'avatar' | fallback
return '1024x1024';
}