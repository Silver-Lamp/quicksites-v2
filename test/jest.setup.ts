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
