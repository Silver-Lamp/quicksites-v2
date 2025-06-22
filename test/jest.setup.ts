// Polyfills for test environment
import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';
import fetch, { Request, Response, Headers } from 'node-fetch';

globalThis.TextEncoder = TextEncoder as any;
globalThis.TextDecoder = TextDecoder as any;

// Polyfill global fetch for Node
if (!globalThis.fetch) globalThis.fetch = fetch as any;
if (!globalThis.Request) globalThis.Request = Request as any;
if (!globalThis.Response) globalThis.Response = Response as any;
if (!globalThis.Headers) globalThis.Headers = Headers as any;
