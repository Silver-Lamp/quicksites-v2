'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Merchant = {
  id: string;
  name: string;
  avatar_url: string | null;
  city: string | null;
  region: string | null;
};

export default function ChefsList({ siteId, slug, showSearch = true, limit = 120 }:{siteId?:string;slug?:string;showSearch?:boolean;limit?:number;}) {
    const [loading, setLoading] = useState(true);
    const [raw, setRaw] = useState<Merchant[]>([]);
    const [q, setQ] = useState('');
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);

    const filtered = useMemo(() => {
        const term = q.trim().toLowerCase();
        const arr = term
        ? raw.filter(m => {
            const loc = [m.city, m.region].filter(Boolean).join(', ').toLowerCase();
            return m.name.toLowerCase().includes(term) || loc.includes(term);
            })
        : raw;
        return arr.slice(0, limit);
    }, [raw, q, limit]);

    async function load(p=1, append=false) {
        if (!append) setLoading(true);
        try {
        const params = new URLSearchParams({ ...(siteId ? { siteId } : {}), ...(slug ? { slug } : {}), page: String(p), pageSize: '30' });
        const r = await fetch(`/api/public/merchants?${params.toString()}`);
        const data = await r.json();
        setRaw(prev => append ? [...prev, ...(data?.merchants ?? [])] : (data?.merchants ?? []));
        setHasMore(Boolean(data?.hasMore));
        setPage(p);
        } finally {
        if (!append) setLoading(false);
        }
    }

    useEffect(() => { load(1, false); /* eslint-disable-next-line */ }, [siteId, slug]);
  

  return (
    <div className="space-y-4">
      {showSearch && (
        <div className="flex gap-2 max-w-xl">
          <Input
            placeholder="Search chefs (name or location)…"
            value={q}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQ(e.target.value)}
          />
          <Button onClick={() => { /* no-op, type=button for enter key clarity */ }} type="button">Search</Button>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading chefs…</div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-muted-foreground">No chefs found.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((m) => {
            const location = [m.city, m.region].filter(Boolean).join(', ');
            return (
              <Link
                key={m.id}
                href={`/chefs/${m.id}`}
                className="rounded-xl border bg-background hover:shadow-md transition-shadow overflow-hidden"
              >
                <div className="flex items-center gap-4 p-4">
                  {m.avatar_url ? (
                    <img
                      src={m.avatar_url}
                      alt={m.name}
                      className="w-14 h-14 rounded-xl object-cover border"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-muted border" />
                  )}
                  <div className="min-w-0">
                    <div className="font-medium truncate">{m.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {location || '\u00A0'}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {hasMore && (
        <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={async () => { setLoadingMore(true); await load(page + 1, true); setLoadingMore(false); }}
                disabled={loadingMore}
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </Button>
            </div>
          )}
    </div>
  );
}
