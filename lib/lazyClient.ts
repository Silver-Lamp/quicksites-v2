// lib/lazyClient.ts
//
// Defer construction of an SDK client until first use. Module-level
// `const x = new Stripe(process.env.KEY!)` / `new OpenAI(...)` / `new Resend(...)`
// runs at import time, so `next build` (which imports every route module to
// collect page data) throws when the env isn't present — the failure that keeps
// CI's Build step non-blocking (see .github/workflows/ci.yml).
//
// Wrapping the constructor in lazyClient() keeps every call site identical
// (`x.foo.bar()` still works) but constructs lazily and memoizes, so importing
// the module is side-effect-free and the client is only built when actually used
// at request time.
//
//   const stripe = lazyClient(() => new Stripe(process.env.STRIPE_SECRET_KEY!));

export function lazyClient<T extends object>(factory: () => T): T {
  let instance: T | undefined;
  return new Proxy({} as T, {
    get(_target, prop) {
      instance ??= factory();
      const value = Reflect.get(instance as object, prop, instance);
      return typeof value === 'function' ? value.bind(instance) : value;
    },
  });
}
