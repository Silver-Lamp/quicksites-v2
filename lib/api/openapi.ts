import { OpenAPIRegistry, OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import { z, ZodTypeAny } from 'zod';

type RouteConfig = {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  summary?: string;
  description?: string;
  tags?: string[];
  request?: ZodTypeAny;
  responses?: ZodTypeAny;
};

export function generateOpenApi(routes: RouteConfig[], title = 'API', version = '1.0.0') {
  const registry = new OpenAPIRegistry();

  for (const route of routes) {
    const { method, path, summary, description, tags, request, responses } = route;

    registry.registerPath({
      method: method.toLowerCase() as any,
      path,
      summary,
      description,
      tags,
      request: request
        ? {
            body: {
              content: {
                'application/json': {
                  schema: request,
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
              schema: responses || z.any(),
            },
          },
        },
      },
    });
  }

  const generator = new OpenApiGeneratorV3(registry.definitions);
  return generator.generateDocument({
    openapi: '3.0.0',
    info: {
      title,
      version,
    },
  });
}
