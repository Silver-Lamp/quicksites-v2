import { OpenAPIGenerator } from 'zod-to-openapi';
import { z } from 'zod';

type RouteSpec = {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  summary?: string;
  description?: string;
  tags?: string[];
  input?: z.ZodTypeAny;
  output?: z.ZodTypeAny;
};

export function generateOpenApi(
  routes: RouteSpec[],
  title = 'API',
  version = '1.0.0'
) {
  const generator = new OpenAPIGenerator(
    {
      openapi: '3.0.0',
      info: {
        title,
        version,
      },
      paths: {},
    },
    'json'
  );

  for (const route of routes) {
    const { method, path, summary, description, tags, input, output } = route;

    generator.registerPath({
      method: method.toLowerCase() as any,
      path,
      request: input
        ? {
            body: {
              content: {
                'application/json': {
                  schema: input,
                },
              },
            },
          }
        : undefined,
      responses: {
        200: {
          description: 'Success',
          content: {
            'application/json': {
              schema: output || z.any(),
            },
          },
        },
      },
      summary,
      description,
      tags,
    });
  }

  return generator.generateDocument();
}
