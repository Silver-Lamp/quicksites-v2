// lib/blockRegistry.core.ts
import { z } from 'zod';
import type { Block, BlockType, SeedContext } from '@/types/blocks';
import { isBlockType, schemaFor } from '@/types/blocks';
import { DEFAULT_BLOCK_CONTENT } from '@/lib/blocks/defaultBlockContent';

/* ---------------------------------- Aliases --------------------------------- */
// Aliases for legacy/alternate types → canonical BlockType
export const BLOCK_ALIASES: Record<string, BlockType> = {
  services_grid: 'services',
  about: 'text', // legacy "about" maps to your "text" block with HTML
};

/* -------------------------------- Utilities --------------------------------- */
function genId() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g: any = globalThis as any;
  return g.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

function isZodSchema(x: unknown): x is z.ZodTypeAny {
  return !!x && typeof (x as any).safeParse === 'function';
}

/** If schemaFor returns a factory, call it; otherwise return as-is */
function buildMaybeFactory<T = unknown>(x: T): T {
  try {
    // // @ts-expect-error dynamic
    return typeof x === 'function' ? (x as any)() : x;
  } catch {
    return x;
  }
}

/**
 * Normalize whatever schemaFor(...) returns into something with .safeParse(...).
 * Accepts:
 *  - Zod schema (preferred)
 *  - Factory returning a Zod schema
 *  - Objects that only expose .parse(...) (wrap into a minimal shim with safeParse)
 */
function normalizeToZodSchema(raw: unknown): z.ZodTypeAny | null {
  const first = buildMaybeFactory(raw);

  if (isZodSchema(first)) return first;

  if (first && typeof (first as any).parse === 'function') {
    const s: any = first;
    const shim: z.ZodTypeAny = {
      // Provide only what we need here
      safeParse: (val: unknown) => {
        try {
          const out = s.parse(val);
          return { success: true, data: out };
        } catch (err) {
          return { success: false, error: err };
        }
      },
    } as any;
    return shim;
  }

  return null;
}

/* ---------------------------- Canonical type swap ---------------------------- */
export function resolveCanonicalType(input: string): BlockType | null {
  if (isBlockType(input)) return input;
  return BLOCK_ALIASES[input] ?? null;
}

/* ----------------------------- Schema validation ---------------------------- */
export function validateBlock(block: Block) {
  const t = resolveCanonicalType(block.type);
  if (!t) return { ok: false as const, error: new Error(`Unknown block type "${block.type}"`) };

  const rawSchema = schemaFor(t);
  if (!rawSchema) return { ok: false as const, error: new Error(`No schema for type "${t}"`) };

  const schema = normalizeToZodSchema(rawSchema);
  if (!schema) {
    return {
      ok: false as const,
      error: new Error(
        `Schema for "${t}" is not a Zod schema (got ${typeof rawSchema}). ` +
        `Ensure schemaFor("${t}") returns a Zod schema or a factory for one.`
      ),
    };
  }

  const res = schema.safeParse((block as any).props ?? {});
  return res.success
    ? { ok: true as const, value: { ...block, type: t, props: res.data } as Block }
    : { ok: false as const, error: res.error };
}

/* --------------------------------- Factories -------------------------------- */
const FACTORIES: Record<
  string,
  {
    default?: (ctx: SeedContext) => Block;
    seed?: (ctx: SeedContext) => Block | Block[];
  }
> = {
  services: {
    default: (ctx) =>
      ({
        id: genId(),
        type: 'services',
        version: 1,
        props: {
          title: 'Our Services',
          columns: 3,
          items: (ctx.services?.length
            ? ctx.services
            : [{ name: 'Service A' }, { name: 'Service B' }, { name: 'Service C' }]
          )
            .slice(0, 6)
            .map((s) => ({
              name: s.name,
              description: s.description ?? '',
              price: typeof s.price === 'number' ? `$${s.price}` : s.price,
              href: s.href,
              icon: s.icon,
            })),
        },
      } as Block),
    seed: (ctx) =>
      ({
        id: genId(),
        type: 'services',
        version: 1,
        props: {
          title: ctx.industry ? `${ctx.industry} Services` : 'Our Services',
          columns: 3,
          items: (ctx.services?.length ? ctx.services : ctx.products ?? [])
            .slice(0, 6)
            .map((p) => ({
              name: p.name,
              description: p.description ?? '',
              price:
                typeof p.price === 'number'
                  ? `$${p.price}`
                  : (p.price as string | undefined),
              href: (p as any).href,
            })),
        },
      } as Block),
  },

  // "about" → alias to 'text'; simple HTML block
  text: {
    seed: (ctx) =>
      ({
        id: genId(),
        type: 'text',
        version: 1,
        props: {
          html:
            `<h2>About ${ctx.merchant?.name ?? 'Us'}</h2>` +
            `<p>${
              ctx.merchant?.about ??
              `${ctx.merchant?.name ?? 'We'} are your local ${
                ctx.industry?.toLowerCase?.() ?? 'business'
              } in ${ctx.locale?.city ?? ''}${
                ctx.locale?.region
                  ? ', ' + ctx.locale.region
                  : ctx.locale?.state
                  ? ', ' + ctx.locale.state
                  : ''
              }.`
            }</p>`,
        },
      } as Block),
  },
};

/* ------------------------------ Default builders ---------------------------- */
export function makeDefaultBlock(
  inputType: string,
  ctx?: Partial<SeedContext>
): Block | null {
  const t = resolveCanonicalType(inputType);
  if (!t) return null;

  const base =
    FACTORIES[t]?.default?.(toCtx(ctx)) ??
    ({
      id: genId(),
      type: t,
      version: 1,
      props: (DEFAULT_BLOCK_CONTENT as any)[t],
    } as Block);

  const v = validateBlock(base);
  return v.ok ? v.value : base; // fall back to base even if validation fails
}

export function makeSeededBlock(
  inputType: string,
  ctx: SeedContext
): Block | Block[] | null {
  const t = resolveCanonicalType(inputType);
  if (!t) return null;

  const seed = FACTORIES[t]?.seed;
  if (!seed) return makeDefaultBlock(t, ctx);

  const out = seed(ctx);
  const arr = Array.isArray(out) ? out : [out];

  const checked = arr.map((b) => {
    const v = validateBlock(b);
    return v.ok ? v.value : b;
  });

  return Array.isArray(out) ? checked : checked[0];
}

/* --------------------------------- Context ---------------------------------- */
function toCtx(partial?: Partial<SeedContext>): SeedContext {
  const id = () => genId();
  const random = () => Math.random();
  return { id, random, ...(partial ?? {}) } as SeedContext;
}
