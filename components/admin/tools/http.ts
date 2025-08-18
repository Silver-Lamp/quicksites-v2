// components/admin/tools/http.ts
export async function getJSON<T = any>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, {
      method: 'GET',
      credentials: 'include',     // ← send Supabase cookies
      cache: 'no-store',
      ...init,
    });
    if (!res.ok) throw new Error((await tryJson(res))?.error || res.statusText);
    return (await res.json()) as T;
  }
  
  export async function postJSON<T = any>(url: string, body: unknown, init?: RequestInit): Promise<T> {
    const res = await fetch(url, {
      method: 'POST',
      credentials: 'include',     // ← send Supabase cookies
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
      body: JSON.stringify(body),
      ...init,
    });
    if (!res.ok) throw new Error((await tryJson(res))?.error || res.statusText);
    return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
  }
  
  async function tryJson(res: Response) { try { return await res.json(); } catch { return null; } }
  