// lib/ai/imageModel.ts — the ONE OpenAI image model every generation uses.
//
// ⚠️ OpenAI retired `gpt-image-1` (found 2026-10-23): it still appears in /v1/models, but
// /v1/images/generations answers 400 "The model 'gpt-image-1' does not exist." Every hero,
// favicon, icon, logo and backdrop generation was failing as a 500, with the model name typed
// into fifteen files. One constant now; a pricing row in `ai_model_pricing` must exist for it,
// because the meter throws "Pricing missing" for an unpriced model before any call is made.
//
// gpt-image-1.5 chosen over gpt-image-2 on a measured test with our real settings (1536x1024,
// quality 'medium'): same sizes and PNG/b64 output, 17 s vs 27 s.
export const IMAGE_MODEL = 'gpt-image-1.5';
