// Polyfills for test environment
import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';
import fetch, { Request, Response, Headers } from 'node-fetch';

globalThis.TextEncoder = TextEncoder;
globalThis.TextDecoder = TextDecoder;

// Polyfill global fetch for Node
if (!globalThis.fetch) globalThis.fetch = fetch;
if (!globalThis.Request) globalThis.Request = Request;
if (!globalThis.Response) globalThis.Response = Response;
if (!globalThis.Headers) globalThis.Headers = Headers;
