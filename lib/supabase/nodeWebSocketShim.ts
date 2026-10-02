// lib/supabase/nodeWebSocketShim.ts
//
// Make `@supabase/supabase-js` constructable on Node 20.
//
// ⚠️ WHY A SHIM WHEN THE REPO IS PINNED TO NODE 24. It is — `.nvmrc` says 24, `engines.node` is
// 24.x — but a terminal that has not run `nvm use` is still on whatever the shell defaults to,
// and `supabase-js` then throws "Node.js 20 detected without native WebSocket support" while
// merely CONSTRUCTING the client. The failure has nothing to do with what the script is doing:
// `scripts/mux-narration.mts` reads one table and never opens a socket.
//
// ⚠️ IT MUST RUN BEFORE THE CLIENT IS IMPORTED, which in ESM means the importing module has to
// use a DYNAMIC `await import()` for the client — static imports are hoisted above every
// statement in the file, so `globalThis.WebSocket = ...` at the top still runs too late. That
// exact trap ate an afternoon on 2026-10-01 and is why the admin client is imported dynamically
// in these scripts.

export async function installNodeWebSocket(): Promise<void> {
  if (typeof (globalThis as { WebSocket?: unknown }).WebSocket !== 'undefined') return;
  try {
    // `ws` ships no types and is a Node-only dependency; the shape we need is one constructor.
    const ws: { default?: unknown } = await import(/* webpackIgnore: true */ 'ws' as string);
    (globalThis as { WebSocket?: unknown }).WebSocket = ws.default ?? ws;
  } catch {
    // Leave it absent: supabase-js throws a clear, actionable message of its own, which beats a
    // vaguer one from here.
  }
}
