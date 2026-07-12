// lib/ai/openaiClient.ts
//
// Single place to construct the OpenAI client. When AI_GATEWAY_ENABLED=true and
// AI_GATEWAY_API_KEY is set, chat + embeddings are routed through Vercel's AI
// Gateway (one key across providers, automatic failover, unified spend). Image
// generation stays on the direct OpenAI API — the gateway's OpenAI-compatible
// surface is chat + embeddings, not image generation.
//
// The gateway addresses models as `creator/model-name`, so resolveModel() prefixes
// bare OpenAI ids with `openai/` when (and only when) the gateway is in use. The
// existing metering wrapper (lib/ai/meter.ts) is unaffected — it still logs cost
// and enforces budgets around whatever this client returns.
//
// Flag OFF (default) → behaviour is identical to `new OpenAI({ apiKey: OPENAI_API_KEY })`.

import OpenAI from 'openai';

export type OaiModality = 'chat' | 'embeddings' | 'image';

const GATEWAY_ENABLED =
  process.env.AI_GATEWAY_ENABLED === 'true' && !!process.env.AI_GATEWAY_API_KEY;
const GATEWAY_BASE_URL = process.env.AI_GATEWAY_BASE_URL || 'https://ai-gateway.vercel.sh/v1';

/** True when this call should go through the gateway (never for image gen). */
export function usesGateway(modality: OaiModality = 'chat'): boolean {
  return GATEWAY_ENABLED && modality !== 'image';
}

/**
 * Construct an OpenAI client for the given modality. Chat/embeddings use the
 * gateway when enabled; image generation always hits OpenAI directly.
 */
export function getOpenAI(modality: OaiModality = 'chat'): OpenAI {
  if (usesGateway(modality)) {
    return new OpenAI({ apiKey: process.env.AI_GATEWAY_API_KEY, baseURL: GATEWAY_BASE_URL });
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

/**
 * Map a model id for the active transport. Under the gateway, bare OpenAI ids
 * (e.g. "gpt-4o-mini") are prefixed to "openai/gpt-4o-mini"; anything already
 * namespaced (contains "/") is passed through, so you can opt into other
 * providers (e.g. "anthropic/claude-…") once the gateway is on. Direct OpenAI
 * calls are returned unchanged.
 */
export function resolveModel(model: string, modality: OaiModality = 'chat'): string {
  if (!usesGateway(modality)) return model;
  return model.includes('/') ? model : `openai/${model}`;
}
