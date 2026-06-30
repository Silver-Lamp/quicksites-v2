// lib/api/parseJson.ts
//
// Lightweight request-body validation for route handlers that own their own
// auth and status codes (the norm in this codebase — see CLAUDE.md §7). Unlike
// withInputOutputValidation, which takes over the whole request/response and can
// only emit 200/400/500, this returns a discriminated result so a handler can
// validate input in two lines and keep full control of 401/403/404/429/etc.:
//
//   const parsed = await parseJsonBody(req, MySchema);
//   if (!parsed.ok) return parsed.response;   // 400 with field details
//   const body = parsed.data;                 // fully typed + validated
//
// Mirrors the shape of lib/auth/requireTemplateOwner for consistency.

import { ZodSchema } from 'zod';
import { NextResponse } from 'next/server';

export type ParsedBody<T> = { ok: true; data: T } | { ok: false; response: NextResponse };

export async function parseJsonBody<T>(req: Request, schema: ZodSchema<T>): Promise<ParsedBody<T>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Invalid or missing JSON body' }, { status: 400 }),
    };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 },
      ),
    };
  }

  return { ok: true, data: parsed.data };
}
