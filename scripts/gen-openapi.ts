import { OpenAPIGenerator } from 'zod-to-openapi';
import { z } from 'zod';
import fs from 'fs';

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
      info: { title, version },
      paths: {},
    },
    'json'
  );

  for (const route of routes) {
    generator.registerPath({
      method: route.method.toLowerCase() as any,
      path: route.path,
      summary: route.summary,
      description: route.description,
      tags: route.tags,
      request: route.input
        ? {
            body: {
              content: {
                'application/json': {
                  schema: route.input,
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
              schema: route.output || z.any(),
            },
          },
        },
      },
    });
  }

  return generator.generateDocument();
}
