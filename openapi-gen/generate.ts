// generate.ts
import { OpenAPIRegistry, OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

const registry = new OpenAPIRegistry();

const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
});

registry.registerComponent('schemas', 'User', UserSchema as any);

registry.registerPath({
  method: 'get',
  path: '/users',
  responses: {
    200: {
      description: 'Returns all users',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/User' },
        },
      },
    },
  },
});

const generator = new OpenApiGeneratorV3(registry.definitions);
const document = generator.generateDocument({
  openapi: '3.0.0',
  info: {
    title: 'Example API',
    version: '1.0.0',
  },
});

console.log(JSON.stringify(document, null, 2));
