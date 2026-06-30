// Polyfills for the test environment.
import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';

// jsdom doesn't provide these.
if (!globalThis.TextEncoder) globalThis.TextEncoder = TextEncoder as any;
if (!globalThis.TextDecoder) globalThis.TextDecoder = TextDecoder as any;

// fetch / Request / Response / Headers are global on Node 18+ (this repo is on
// Node 20), so no node-fetch polyfill is needed — importing node-fetch (v3, ESM)
// here actually breaks Jest's CommonJS transform.
