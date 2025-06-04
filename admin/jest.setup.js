require('@testing-library/jest-dom');

const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Polyfill global.fetch for testing API calls in Node
if (!global.fetch) {
    global.fetch = require('node-fetch');
  }
// Inject missing globals for MSW + fetch support
const fetch = require('node-fetch');

if (!global.fetch) global.fetch = fetch;
if (!global.Request) global.Request = fetch.Request;
if (!global.Response) global.Response = fetch.Response;
if (!global.Headers) global.Headers = fetch.Headers;
