import { ZodSchema } from 'zod';
import { badRequest, internalError } from './json.js';

export function withInputValidation<T>(
  schema: ZodSchema<T>,
  handler: (input: T, req: Request) => Promise<Response>
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    try {
      const body = await req.json();
      const result = schema.safeParse(body);
      if (!result.success) {
        return badRequest('Invalid input', result.error.format());
      }
      return handler(result.data, req);
    } catch (err: any) {
      return internalError(err.message || 'Failed to parse request body');
    }
  };
}

export function withOutputValidation<T>(
  handler: (req: Request) => Promise<T>,
  schema: ZodSchema<T>
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    try {
      const result = await handler(req);
      const parsed = schema.safeParse(result);
      if (!parsed.success) {
        return internalError('Invalid output format');
      }
      return Response.json(parsed.data);
    } catch (err: any) {
      return internalError(err.message || 'Server error');
    }
  };
}

export function withValidatedRoute<TInput, TOutput>({
  input,
  output,
  handler,
}: {
  input?: ZodSchema<TInput>;
  output?: ZodSchema<TOutput>;
  handler: (input: TInput | undefined, req: Request) => Promise<TOutput>;
}): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    try {
      let parsedInput: TInput | undefined = undefined;

      if (input) {
        const body = await req.json();
        const result = input.safeParse(body);
        if (!result.success) {
          return badRequest('Invalid input', result.error.format());
        }
        parsedInput = result.data;
      }

      const data = await handler(parsedInput, req);

      if (output) {
        const result = output.safeParse(data);
        if (!result.success) {
          return internalError('Invalid output format');
        }
        return Response.json(result.data);
      }

      return Response.json(data);
    } catch (err: any) {
      return internalError(err.message || 'Server error');
    }
  };
}
