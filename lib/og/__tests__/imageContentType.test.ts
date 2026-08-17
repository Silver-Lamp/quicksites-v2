/** @jest-environment node */
// Pins the rule that a filename is not evidence about bytes.
//
// The live bug: /api/og/[slug]/image cached at `snapshots/<slug>.svg`, stamped every response
// `image/svg+xml` from that path, and the cached object was a PNG. The browser trusted the header,
// tried to parse PNG as XML, and drew a broken-image icon on lemonyum.com — inside the one section
// of that page whose entire job is to prove we can build a real site.
//
// What makes it worth a test rather than a comment is how well it hid: HTTP 200, a plausible
// content type, 32KB of real bytes, no CORS error, no CSP, byte-identical across two hosts. The
// fetch was never broken. Only `file` and the first eight bytes could see it.

import { sniffImageContentType, extensionForContentType } from '../imageContentType';

const png = () => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 73, 72, 68, 82]);
const jpeg = () => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 0, 0, 0, 0]);
const gif = () => new Uint8Array([...Buffer.from('GIF89a'), 1, 0, 1, 0, 0x80, 0, 0, 0, 0, 0, 0]);
const webp = () => new Uint8Array([...Buffer.from('RIFF'), 0x1a, 0, 0, 0, ...Buffer.from('WEBPVP8 ')]);
const svg = (s = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>') =>
  new Uint8Array(Buffer.from(s));

describe('sniffImageContentType', () => {
  it('identifies each format from its magic number', () => {
    expect(sniffImageContentType(png())).toBe('image/png');
    expect(sniffImageContentType(jpeg())).toBe('image/jpeg');
    expect(sniffImageContentType(gif())).toBe('image/gif');
    expect(sniffImageContentType(webp())).toBe('image/webp');
  });

  it('calls a PNG a PNG no matter what it is named — the actual bug', () => {
    // The poisoned cache object was literally these bytes at a `.svg` path.
    expect(sniffImageContentType(png())).toBe('image/png');
    expect(sniffImageContentType(png())).not.toBe('image/svg+xml');
  });

  it('recognises SVG by content, in each shape a generator emits', () => {
    expect(sniffImageContentType(svg())).toBe('image/svg+xml');
    expect(sniffImageContentType(svg('<?xml version="1.0"?><svg width="1" height="1"></svg>'))).toBe('image/svg+xml');
    expect(sniffImageContentType(svg('  \n <svg width="1" height="1"></svg>'))).toBe('image/svg+xml');
  });

  it('does not mistake a binary payload for SVG', () => {
    // SVG is matched last and by content precisely so binary never falls through to it.
    expect(sniffImageContentType(webp())).not.toBe('image/svg+xml');
  });

  it('returns null on unrecognised bytes rather than guessing', () => {
    // ⚠️ Null is the feature. Asserting a plausible type for unknown bytes IS the original bug,
    // and a caller that must handle null cannot accidentally reintroduce it.
    expect(sniffImageContentType(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]))).toBeNull();
    expect(sniffImageContentType(new Uint8Array(Buffer.from('just some text, not markup')))).toBeNull();
  });

  it('returns null for input too short to identify', () => {
    expect(sniffImageContentType(new Uint8Array([0x89, 0x50]))).toBeNull();
    expect(sniffImageContentType(new Uint8Array())).toBeNull();
  });
});

describe('extensionForContentType', () => {
  it('round-trips every type the sniffer can return', () => {
    // A cache path built from the sniffed type is how the extension stops disagreeing with the
    // bytes in the first place.
    for (const [type, ext] of [
      ['image/png', 'png'],
      ['image/jpeg', 'jpg'],
      ['image/gif', 'gif'],
      ['image/webp', 'webp'],
      ['image/svg+xml', 'svg'],
    ] as const) {
      expect(extensionForContentType(type)).toBe(ext);
    }
  });

  it('does not invent an extension for an unknown type', () => {
    expect(extensionForContentType('application/octet-stream')).toBe('bin');
  });
});
