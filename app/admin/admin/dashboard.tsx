// app/admin/admin/dashboard.tsx
'use client';

import { useEffect, useState } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { supabase } from '@/admin/lib/supabaseClient';

export default function AdminDashboard() {
  const { isAdmin } = useCurrentUser();

  const [embedViews, setEmbedViews] = useState<number>(0);
  const [dailyViews, setDailyViews] = useState<number>(0);
  const [links, setLinks] = useState<number>(0);
  const [emails, setEmails] = useState<number>(0);
  const [logs, setLogs] = useState<number>(0);

  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();

    const fetchCounts = async () => {
      setErr(null);
      try {
        const [
          { count: viewsCount },
          { count: linksCount },
          { count: emailsCount },
          { count: logsCount },
        ] = await Promise.all([
          supabase.from('embed_views').select('*', { count: 'exact', head: true }),
          supabase.from('schema_links').select('*', { count: 'exact', head: true }),
          supabase.from('email_summaries').select('*', { count: 'exact', head: true }),
          supabase.from('log_events').select('*', { count: 'exact', head: true }),
        ]);

        setEmbedViews(viewsCount || 0);
        setLinks(linksCount || 0);
        setEmails(emailsCount || 0);
        setLogs(logsCount || 0);

        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { count: viewsToday, error } = await supabase
          .from('embed_views')
          .select('*', { count: 'exact', head: true })
          .gt('created_at', dayAgo);

        if (error) throw error;
        setDailyViews(viewsToday || 0);
      } catch (e: any) {
        // If RLS forbids counting, you’ll land here.
        setErr(e?.message || 'Failed to load metrics');
      }
    };

    fetchCounts();
    return () => ac.abort();
  }, []);

  const downloadCsv = async (path: string, filename: string) => {
    try {
      const res = await fetch(path, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const maybeJson = await res
          .clone()
          .json()
          .catch(() => ({} as any));
        throw new Error(maybeJson?.error || res.statusText);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(`Download failed: ${e?.message || e}`);
    }
  };

  const clearLogs = async () => {
    if (!confirm('Are you sure you want to clear all logs?')) return;
    try {
      const res = await fetch('/api/admin/clear-logs', {
        method: 'POST',
        credentials: 'include',
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result?.error || res.statusText);
      alert('Logs cleared successfully');
      setLogs(0);
    } catch (e: any) {
      alert(`Failed to clear logs: ${e?.message || e}`);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <h1 className="mb-4 text-2xl font-bold">🛠 Admin Tools... Coming Soon</h1>

      {err && <p className="text-sm text-red-500">Error: {err}</p>}

      {isAdmin && (
        <Card className="border border-border/60">
          <CardHeader className="text-lg font-semibold">Seed Tools</CardHeader>
          <CardContent>
            <p className="mb-2 text-sm text-muted-foreground">
              Quickly add an example template to test the builder.
              <br />
              (Seed Button Coming Soon)
            </p>
            {/* <SeedButton /> */}
          </CardContent>
        </Card>
      )}

      {isAdmin && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Embed Views */}
          <Card className="relative border border-border/60 transition-transform duration-200 hover:scale-[1.01] hover:shadow-md">
            <div
              className={`absolute right-3 top-2 font-mono text-sm ${
                dailyViews > 100 ? 'animate-pulse text-green-500' : 'text-blue-600'
              }`}
            >
              +{embedViews} views
              <br />({dailyViews} today)
            </div>
            <CardHeader className="text-lg font-semibold text-blue-600">📊 Embed Views</CardHeader>
            <CardContent>
              <p className="mb-2 text-sm text-muted-foreground">
                Track views by location and volume.
              </p>
              <a href="/admin/embed-views" className="text-sm text-blue-600 underline">
                View Logs →
              </a>
              <button
                onClick={() => downloadCsv('/api/admin/logs-export-csv?table=embed_views', 'embed-views.csv')}
                className="mt-2 text-xs text-blue-600 underline hover:text-blue-700"
              >
                Download Embed Views CSV
              </button>
            </CardContent>
          </Card>

          {/* Shortlink Manager */}
          <Card className="relative border border-border/60 transition-transform duration-200 hover:scale-[1.01] hover:shadow-md">
            <div
              className={`absolute right-3 top-2 font-mono text-sm ${
                links > 50 ? 'animate-pulse text-green-600' : 'text-green-600'
              }`}
            >
              {links} links
            </div>
            <CardHeader className="text-lg font-semibold text-green-600">🔗 Shortlink Manager</CardHeader>
            <CardContent>
              <p className="mb-2 text-sm text-muted-foreground">
                Create and manage short schema links.
              </p>
              <a href="/admin/links" className="text-sm text-blue-600 underline">
                Open Shortlinks →
              </a>
              <button
                onClick={() => downloadCsv('/api/admin/logs-export-csv?table=schema_links', 'schema-links.csv')}
                className="mt-2 text-xs text-green-600 underline hover:text-green-700"
              >
                Download Schema Links CSV
              </button>
            </CardContent>
          </Card>

          {/* Email Summary */}
          <Card className="relative border border-border/60">
            <div
              className={`absolute right-3 top-2 font-mono text-sm ${
                emails > 10 ? 'animate-pulse text-yellow-600' : 'text-yellow-600'
              }`}
            >
              {emails} emails
            </div>
            <CardHeader className="text-lg font-semibold text-yellow-600">📬 Email Summary</CardHeader>
            <CardContent>
              <p className="mb-2 text-sm text-muted-foreground">
                Review auto-generated summaries or drafts.
              </p>
              <a href="/admin/email-summary" className="text-sm text-blue-600 underline">
                Check Inbox →
              </a>
            </CardContent>
          </Card>

          {/* Export Logs */}
          <Card className="relative border border-border/60 transition-transform duration-200 hover:scale-[1.01] hover:shadow-md">
            <div
              className={`absolute right-3 top-2 font-mono text-sm ${
                logs > 25 ? 'animate-pulse text-purple-600' : 'text-purple-600'
              }`}
            >
              {logs} logs
            </div>
            <CardHeader className="text-lg font-semibold text-purple-600">📥 Export Logs</CardHeader>
            <CardContent>
              <p className="mb-2 text-sm text-muted-foreground">
                Download platform usage logs and events.
              </p>
              <button
                onClick={() => downloadCsv('/api/admin/logs-export-csv?table=log_events', 'logs-export.csv')}
                className="mt-2 text-xs text-blue-600 underline hover:text-blue-700"
              >
                Download Logs CSV
              </button>
              <button
                onClick={clearLogs}
                className="mt-2 text-xs text-red-500 underline hover:text-red-600"
              >
                Clear Logs
              </button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
