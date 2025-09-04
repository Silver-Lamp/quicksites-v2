// app/api/agents/block-schema/route.ts
// Returns a best-effort extracted field list from a block's Zod schema
// ===============================
import { NextRequest as NextRequestSchema } from 'next/server';

export const dynamicSchema = 'force-dynamic';

export async function GET(req: NextRequestSchema) {
  try {
    const key = new URL(req.url).searchParams.get('key') || '';
    if (!key) return new Response(JSON.stringify({ error: 'missing key' }), { status: 400 });

    const mod = await import('@/admin/lib/zod/blockSchema');
    const map: Record<string, any> = (mod as any).blockContentSchemaMap || {};
    const schema = map[key];
    if (!schema) return new Response(JSON.stringify({ error: 'unknown key' }), { status: 404 });

    const fields = extractFieldsFromZod(schema);
    return new Response(JSON.stringify({ key, fields }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

// ---- Zod runtime extraction helpers ----
function extractFieldsFromZod(schema: any): { name: string; type: string; options?: string[] }[] {
  try {
    const typeName: string = schema?._def?.typeName;
    if (typeName === 'ZodEffects') return extractFieldsFromZod(schema._def.schema);
    if (typeName !== 'ZodObject') return [];

    const shape = schema._def.shape();
    const out: any[] = [];
    for (const [name, z] of Object.entries<any>(shape)) {
      out.push(toField(name, z));
    }
    return out;
  } catch {
    return [];
  }
}

function toField(name: string, z: any): { name: string; type: string; options?: string[] } {
  while (z?._def?.typeName === 'ZodEffects' || z?._def?.typeName === 'ZodOptional' || z?._def?.typeName === 'ZodDefault' || z?._def?.typeName === 'ZodNullable') {
    z = z._def.schema ?? z._def.innerType ?? z._def.type;
  }
  const t = z?._def?.typeName;
  switch (t) {
    case 'ZodString': {
      const checks: any[] = z._def.checks || [];
      const isUrl = checks.some((c: any) => c?.kind === 'url');
      return { name, type: isUrl ? 'url' : 'string' };
    }
    case 'ZodNumber': return { name, type: 'number' };
    case 'ZodBoolean': return { name, type: 'boolean' };
    case 'ZodArray': {
      const inner = toField('__inner__', z._def.type).type;
      return { name, type: `array(${inner})` };
    }
    case 'ZodEnum': return { name, type: 'enum', options: z._def.values || [] };
    case 'ZodNativeEnum': return { name, type: 'enum', options: Object.values(z._def.values || {}).map(String) };
    case 'ZodObject': return { name, type: 'object' };
    default: return { name, type: 'object' };
  }
}

