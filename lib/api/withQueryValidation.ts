import { ZodSchema } from 'zod';
import { badRequest, internalError } from './json';

export function withQueryValidation<TQuery>(
  schema: ZodSchema<TQuery>,
  handler: (query: TQuery, req: Request) => Promise<Response>
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    try {
      const url = new URL(req.url);
      const queryObject: Record<string, string> = {};

      for (const [key, value] of url.searchParams.entries()) {
        queryObject[key] = value;
      }

      const parsed = schema.safeParse(queryObject);
      if (!parsed.success) {
        return badRequest('Invalid query parameters', parsed.error.format());
      }

      return handler(parsed.data, req);
    } catch (err: any) {
      return internalError(err.message || 'Failed to process query params');
    }
  };
}
