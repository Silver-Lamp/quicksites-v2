import { z, ZodError } from 'zod';
// import { json, internalError } from './json.js';
//
// 🔁 Response Builders
//

export function json(data: unknown, statusOrOptions?: number | ResponseInit): Response {
  if (typeof statusOrOptions === 'number') {
    return new Response(JSON.stringify(data), {
      status: statusOrOptions,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...statusOrOptions,
  });
}

export function typedJson<T>(data: T, statusOrOptions?: number | ResponseInit): Response {
  return json(data, statusOrOptions);
}

export function safeTypedJson<T>(
  data: unknown,
  schema: z.ZodType<T, any, any>,
  statusOrOptions?: number | ResponseInit
): Response {

  const result = schema.safeParse(data);
  if (!result.success) {
    return internalError('Invalid server response', result.error.format());
  }
  return json(result.data, statusOrOptions);
}

//
// ❌ Error Responses
//

export function badRequest(message: string, details?: unknown): Response {
  return json({ error: message, ...(details ? { issues: details } : {}) }, 400);
}

export function internalError(message: string, details?: unknown): Response {
  return json({ error: message, ...(details ? { issues: details } : {}) }, 500);
}

export function unauthorized(message: string = 'Unauthorized'): Response {
  return json({ error: message }, 401);
}

export function validationError(details: unknown): Response {
  return badRequest('Validation failed', details);
}

export function flattenIssues(error: ZodError): string[] {
  return error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
}

//
// ✅ withInput() for request body validation
//

export function withInput<T>(
  schema: z.ZodType<T, any, any>,
  handler: (input: T, req: Request) => Promise<Response>
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    try {
      const body = await req.json();
      const result = schema.safeParse(body);
      if (!result.success) {
        return validationError(result.error.format());
      }
      return handler(result.data, req);
    } catch (err: any) {
      return internalError(err.message || 'Failed to parse request body');
    }
  };
}

//
// ✅ withValidation() for output validation
//

export function withValidation<T>(
  handler: () => Promise<T>,
  schema: z.ZodType<T, any, any>
): (req: Request) => Promise<Response> {
  return async () => {
    try {
      const result = await handler();
      const parsed = schema.safeParse(result);
      if (!parsed.success) {
        return json({ error: 'Output validation failed', details: parsed.error.format() }, 500);
      }
      return json(parsed.data);
    } catch (err: any) {
      return internalError(err.message || 'Unexpected error');
    }
  };
}

//
// 🧠 withMethod() for HTTP verb routing and middleware support
//

export type HandlerMap = {
  GET?: (req: Request) => Promise<Response>;
  POST?: (req: Request) => Promise<Response>;
  PUT?: (req: Request) => Promise<Response>;
  DELETE?: (req: Request) => Promise<Response>;
  PATCH?: (req: Request) => Promise<Response>;
};

export type WithMethodOptions = {
  beforeEach?: (req: Request) => Promise<Response | void>;
};

export function withMethod(
  handlers: HandlerMap,
  options: WithMethodOptions = {}
): (req: Request) => Promise<Response> {
  return async function handler(req: Request): Promise<Response> {
    const method = req.method.toUpperCase() as keyof HandlerMap;

    if (options.beforeEach) {
      const result = await options.beforeEach(req);
      if (result instanceof Response) return result;
    }

    if (handlers[method]) {
      return handlers[method]!(req);
    }

    return new Response('Method Not Allowed', {
      status: 405,
      headers: { Allow: Object.keys(handlers).join(', ') },
    });
  };
}
