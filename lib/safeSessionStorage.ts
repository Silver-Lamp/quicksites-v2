// lib/safeSessionStorage.ts
export function safeGet<T = unknown>(key: string): T | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = sessionStorage.getItem(key) || localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  
  export function safeSet(key: string, value: unknown, useLocal: boolean = false) {
    if (typeof window === 'undefined') return;
    try {
      const encoded = JSON.stringify(value);
      if (useLocal) {
        localStorage.setItem(key, encoded);
      } else {
        sessionStorage.setItem(key, encoded);
      }
    } catch {}
  }
  
  export function safeRemove(key: string, useLocal: boolean = false) {
    if (typeof window === 'undefined') return;
    if (useLocal) {
      localStorage.removeItem(key);
    } else {
      sessionStorage.removeItem(key);
    }
  }
  