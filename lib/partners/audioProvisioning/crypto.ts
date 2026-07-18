// lib/partners/audioProvisioning/crypto.ts
//
// AES-256-GCM encrypt/decrypt for grant tokens at rest (contract: "QS stores them
// server-side, encrypted at rest"). Server-only — the key never reaches the client.
//
// Serialized form: `v1:<iv-b64>:<tag-b64>:<ciphertext-b64>` (versioned so we can rotate
// the scheme later). Key from PARTNER_GRANT_ENC_KEY — a 32-byte key as 64 hex chars or
// base64. Throws if the key is missing/wrong-length so a misconfig fails loud, never
// silently storing a token in the clear.

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

function key(): Buffer {
  const raw = process.env.PARTNER_GRANT_ENC_KEY || '';
  if (!raw) throw new Error('PARTNER_GRANT_ENC_KEY is not set');
  // Accept hex (64 chars) or base64; must decode to exactly 32 bytes.
  const buf = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
  if (buf.length !== 32) throw new Error('PARTNER_GRANT_ENC_KEY must decode to 32 bytes');
  return buf;
}

export function encryptGrant(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`;
}

export function decryptGrant(serialized: string): string {
  const parts = serialized.split(':');
  if (parts.length !== 4 || parts[0] !== 'v1') throw new Error('bad grant ciphertext');
  const [, ivB64, tagB64, ctB64] = parts;
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()]).toString('utf8');
}
