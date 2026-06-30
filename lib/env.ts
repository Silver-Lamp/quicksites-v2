// lib/env.ts
//
// Single, validated source of truth for environment variables. Replaces the
// scattered `process.env.X || 'default'` reads (see CLAUDE.md §6 — "secrets are
// read ad-hoc … no validated env loader yet") and is the Deno-portable seam the
// backend split needs (docs/ARCHITECTURE.md §6.3).
//
// LAZY BY DESIGN: nothing here validates at import time. getEnv() parses on first
// call and caches; the convenience accessors read process.env directly and throw
// a clear message only when a genuinely-required value is missing. This matters
// because `next build` imports route modules during page-data collection without
// a full env — a loader that validated at module load would break the build (the
// exact failure mode that took down CI before; see .github/workflows/ci.yml).
//
// Add new variables to EnvSchema rather than reaching for process.env directly.

import { z } from 'zod';

const EnvSchema = z.object({
  // --- Supabase ---
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_ANON_KEY: z.string().min(1).optional(),
  // instrumentation.ts copies SUPABASE_SECRET_KEY -> SUPABASE_SERVICE_ROLE_KEY at boot.
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  SUPABASE_SECRET_KEY: z.string().min(1).optional(),
  SUPABASE_STORAGE_BUCKET: z.string().min(1).default('site-images'),

  // --- Stripe ---
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),

  // --- OpenAI ---
  OPENAI_API_KEY: z.string().min(1).optional(),

  NODE_ENV: z.enum(['development', 'test', 'production']).optional(),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

/**
 * Parse + validate the whole environment once, cached. Throws an aggregated,
 * readable error if a required/typed variable is invalid. Call this from code
 * that genuinely wants the validated bundle; most callers should prefer the
 * narrow accessors below.
 */
export function getEnv(): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

// --- Narrow accessors: centralize the historical fallbacks + clear errors ---

export function supabaseUrl(): string {
  const v = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!v) throw new Error('Missing env: NEXT_PUBLIC_SUPABASE_URL');
  return v;
}

export function supabaseAnonKey(): string {
  const v = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!v) throw new Error('Missing env: NEXT_PUBLIC_SUPABASE_ANON_KEY');
  return v;
}

export function supabaseServiceRoleKey(): string {
  const v = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!v) throw new Error('Missing env: SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY)');
  return v;
}

export function storageBucket(): string {
  return process.env.SUPABASE_STORAGE_BUCKET || 'site-images';
}

// --- Non-throwing startup check (for instrumentation.ts) ---

/**
 * Report missing required/recommended server env without throwing — safe to call
 * at server startup so a misconfigured deploy logs a clear signal instead of
 * failing deep inside a request with "supabaseUrl is required".
 */
export function validateServerEnv(): { ok: boolean; problems: string[] } {
  const problems: string[] = [];
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    problems.push('NEXT_PUBLIC_SUPABASE_URL is required');
  }
  if (!(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)) {
    problems.push('SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY) is required for server/admin queries');
  }
  if (!(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY)) {
    problems.push('NEXT_PUBLIC_SUPABASE_ANON_KEY is required for user-context queries');
  }
  return { ok: problems.length === 0, problems };
}
