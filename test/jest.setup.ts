// Polyfills for the test environment.
import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';

// jsdom doesn't provide these.
if (!globalThis.TextEncoder) globalThis.TextEncoder = TextEncoder as any;
if (!globalThis.TextDecoder) globalThis.TextDecoder = TextDecoder as any;

// fetch / Request / Response / Headers are global on Node 18+ (this repo is on
// Node 20), so no node-fetch polyfill is needed — importing node-fetch (v3, ESM)
// here actually breaks Jest's CommonJS transform.

// Placeholder Supabase env so modules that construct a client at import time
// (e.g. lib/supabase/client.ts) don't throw "URL and API key are required" when
// a test imports something in their chain. Tests never make real network calls;
// supabase access should be mocked. Mirrors the CI build's placeholder env.
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://placeholder.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'placeholder-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'placeholder-service-role-key';

// ...and the other half of the same problem. Constructing a Supabase client also builds a
// RealtimeClient, which resolves a WebSocket constructor at construction time and throws
// when it can't find one. Neither Node 20 nor jsdom provides a global `WebSocket`, so every
// suite whose import chain reaches lib/supabase/admin.ts (a module-load client) died with
// "Test suite failed to run" — ~10 suites, including all of admin/__tests__. That is a
// whole-suite failure, so it fails CI even when every test in the repo passes.
//
// `ws` is already a dependency. Nothing here makes a real connection: tests mock Supabase
// access, and this only satisfies the constructor lookup.
if (typeof (globalThis as any).WebSocket === 'undefined') {
  try {
    (globalThis as any).WebSocket = require('ws');
  } catch {
    // If `ws` ever goes away, leave it unset — the suites that need it fail loudly with
    // the original error rather than silently behaving differently.
  }
}
