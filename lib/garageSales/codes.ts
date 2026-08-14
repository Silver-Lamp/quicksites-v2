// lib/garageSales/codes.ts
//
// Sticker codes. These are printed on a physical object, handed to a stranger, and sometimes
// typed by hand into a phone because the camera won't focus on a curling sticker in the sun.
// That is the whole design brief.
import crypto from 'crypto';

/**
 * ⚠️ NO O/0, NO I/1/L, NO U.
 *
 * The first three are the classic misreads and this code gets read aloud and typed. U is out for
 * a different reason: it is the letter that turns a random string into a word somebody has to
 * hand to a stranger. A 6-character alphabet with vowels will eventually print something
 * unfortunate on a sticker, and the sticker is not recallable once it is in a shoebox in a car.
 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';

/** 6 chars of this alphabet ≈ 5.9e8 combinations — collision-free at any batch size we'll print. */
const CODE_LEN = 6;

/**
 * One sticker code. Uses crypto randomness, not Math.random: these are bearer secrets — whoever
 * holds the code can claim the sale — so guessable codes would let someone claim a sticker they
 * were never handed. That is also why the stickers table is deny-default in RLS: no enumeration.
 */
export function mintCode(): string {
  const bytes = crypto.randomBytes(CODE_LEN * 2);
  let out = '';
  for (let i = 0; out.length < CODE_LEN && i < bytes.length; i++) {
    // Rejection sampling: modulo over a 256-value byte would bias toward the first
    // (256 % 30) letters of the alphabet. It hardly matters at this scale, but a biased
    // "random" code is the kind of thing that is never noticed and never fixed.
    const v = bytes[i];
    if (v >= 240) continue; // 240 = 8 * 30, the largest multiple of the alphabet under 256
    out += ALPHABET[v % ALPHABET.length];
  }
  // Astronomically unlikely, but a short code is worse than a slow one.
  return out.length === CODE_LEN ? out : mintCode();
}

export function mintCodes(n: number): string[] {
  const set = new Set<string>();
  while (set.size < n) set.add(mintCode());
  return [...set];
}

/**
 * Normalise what a human typed: strip spaces and dashes, uppercase. Nothing else.
 *
 * ⚠️ NO CHARACTER SUBSTITUTION, and the first version of this function got that backwards.
 * It mapped O→0 and I/L→1 "to fix misreads" — but the alphabet contains NEITHER member of those
 * pairs, so the substitution produced characters that can never appear in a real code, turning
 * correctable input into guaranteed-invalid input.
 *
 * The alphabet is the mechanism. Because O/0/I/1/L/U are all absent, any of them in typed input
 * is unambiguously an error — and crucially, an error we cannot resolve: a typed "O" could be a
 * misread Q, D or C. Guessing would silently claim the WRONG sticker, which is the one outcome
 * worth avoiding. Reject and ask, rather than substitute and hope.
 */
export function normalizeCode(input: string): string {
  return (input || '')
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, CODE_LEN);
}

/** Shape check only — says nothing about whether the code exists or is claimable. */
export function isPlausibleCode(input: string): boolean {
  const c = normalizeCode(input);
  return c.length === CODE_LEN && [...c].every((ch) => ALPHABET.includes(ch));
}

/** Display form: `PQ8-R4T`, which is easier to read back over a fence than six run-on characters. */
export function formatCode(code: string): string {
  const c = (code || '').toUpperCase();
  return c.length === CODE_LEN ? `${c.slice(0, 3)}-${c.slice(3)}` : c;
}
