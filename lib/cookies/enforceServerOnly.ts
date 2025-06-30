// lib/cookies/enforceServerOnly.ts
export function assertRouteHandlerContext() {
    if (typeof window !== 'undefined') {
      throw new Error('❌ Cookie modification must happen in a server action or route handler.');
    }
  }
  