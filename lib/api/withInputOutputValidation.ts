import { ZodSchema } from 'zod';
import { badRequest, internalError } from './json';

export function withInputOutputValidation<TInput, TOutput>(
  inputSchema: ZodSchema<TInput>,
  outputSchema: ZodSchema<TOutput>,
  handler: (input: TInput, req: Request) => Promise<TOutput>
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    try {
      const body = await req.json();
      const inputParsed = inputSchema.safeParse(body);
      if (!inputParsed.success) {
        return badRequest('Invalid input', inputParsed.error.format());
      }

      const result = await handler(inputParsed.data, req);
      const outputParsed = outputSchema.safeParse(result);

      if (!outputParsed.success) {
        return internalError('Invalid output format');
      }

      return Response.json(outputParsed.data);
    } catch (err: any) {
      return internalError(err.message || 'Unhandled server error');
    }
  };
}
