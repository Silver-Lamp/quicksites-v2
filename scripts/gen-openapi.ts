// ⚠️ zod-to-openapi v5+ replaced `OpenAPIGenerator(config, 'json')` with a registry + a versioned
// generator. This file imported the old name against the installed v7 for months and threw at
// import time on every run of the "Lint OpenAPI" workflow (red since 2026-06-30 on main; it only
// fires on path triggers, so nobody saw it until a lib/api/ edit tripped it on 2026-10-18).
import { OpenAPIRegistry, OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';

import { z } from 'zod';
import fs from 'node:fs';

type RouteSpec = {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  summary?: string;
  description?: string;
  tags?: string[];
  input?: z.ZodTypeAny;
  output?: z.ZodTypeAny;
};

export function generateOpenApi(routes: RouteSpec[], title = 'API', version = '1.0.0') {
  const registry = new OpenAPIRegistry();

  for (const route of routes) {
    registry.registerPath({
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

  const generator = new OpenApiGeneratorV3(registry.definitions);
  return generator.generateDocument({ openapi: '3.0.0', info: { title, version } });
}
