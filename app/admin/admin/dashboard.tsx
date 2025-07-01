// pages/admin/dashboard.tsx
import Head from 'next/head';
import { json } from '@/lib/api/json';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import SeedButton from '@/components/admin/admin/seed-button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useEffect, useState } from 'react';
import { supabase } from '@/admin/lib/supabaseClient';

export default function AdminDashboard() {
  const { hasRole } = useCurrentUser();

  const [embedViews, setEmbedViews] = useState<number>(0);
  const [dailyViews, setDailyViews] = useState<number>(0);
  const [links, setLinks] = useState<number>(0);
  const [emails, setEmails] = useState<number>(0);
  const [logs, setLogs] = useState<number>(0);

  useEffect(() => {
    const fetchCounts = async () => {
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
      const { count: viewsToday } = await supabase
        .from('embed_views')
        .select('*', { count: 'exact', head: true })
        .gt('created_at', dayAgo);

      setDailyViews(viewsToday || 0);
    };
    fetchCounts();
  }, []);

  return (
    <>
      <Head>
        <title>Admin Dashboard</title>
      </Head>

      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-bold mb-4">🛠 Admin Tools</h1>

        {hasRole(['admin', 'owner']) && (
          <Card>
            <CardHeader className="text-lg font-semibold">Seed Tools</CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500 mb-2">
                Quickly add an example template to test the builder.
              </p>
              <SeedButton />
            </CardContent>
          </Card>
        )}

        {hasRole(['admin', 'owner']) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="relative border-l-4 border-blue-500 transition-transform duration-200 hover:scale-[1.01] hover:shadow-md">
              <div
                className={`absolute top-2 right-3 text-sm font-mono ${dailyViews > 100 ? 'text-green-500 animate-pulse' : 'text-blue-600'}`}
              >
                +{embedViews} views
                <br />({dailyViews} today)
              </div>
              <CardHeader className="text-lg font-semibold text-blue-600">
                📊 Embed Views
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500 mb-2">Track views by location and volume.</p>
                <a href="/admin/embed-views" className="text-blue-600 text-sm underline">
                  View Logs →
                </a>
                <button
                  onClick={async () => {
                    const token = localStorage.getItem('sb-access-token');
                    const res = await fetch('/api/admin/logs-export-csv?table=embed_views', {
                      method: 'POST',
                      headers: { Authorization: `Bearer ${token}` },
                    });
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'embed-views.csv';
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="mt-2 text-xs text-blue-600 underline hover:text-blue-700"
                >
                  Download Embed Views CSV
                </button>
              </CardContent>
            </Card>
            <Card className="relative border-l-4 border-green-500 transition-transform duration-200 hover:scale-[1.01] hover:shadow-md">
              <div
                className={`absolute top-2 right-3 text-sm font-mono ${links > 50 ? 'text-green-600 animate-pulse' : 'text-green-600'}`}
              >
                {links} links
              </div>
              <CardHeader className="text-lg font-semibold text-green-600">
                🔗 Shortlink Manager
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500 mb-2">Create and manage short schema links.</p>
                <a href="/admin/links" className="text-blue-600 text-sm underline">
                  Open Shortlinks →
                </a>
                <button
                  onClick={async () => {
                    const token = localStorage.getItem('sb-access-token');
                    const res = await fetch('/api/admin/logs-export-csv?table=schema_links', {
                      method: 'POST',
                      headers: { Authorization: `Bearer ${token}` },
                    });
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'schema-links.csv';
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="mt-2 text-xs text-green-600 underline hover:text-green-700"
                >
                  Download Schema Links CSV
                </button>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-yellow-500">
              <div
                className={`absolute top-2 right-3 text-sm font-mono ${emails > 10 ? 'text-yellow-600 animate-pulse' : 'text-yellow-600'}`}
              >
                {emails} emails
              </div>
              <CardHeader className="text-lg font-semibold text-yellow-600">
                📬 Email Summary
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500 mb-2">
                  Review auto-generated summaries or drafts.
                </p>
                <a href="/admin/email-summary" className="text-blue-600 text-sm underline">
                  Check Inbox →
                </a>
              </CardContent>
            </Card>
            <Card className="relative border-l-4 border-purple-500 transition-transform duration-200 hover:scale-[1.01] hover:shadow-md">
              <div
                className={`absolute top-2 right-3 text-sm font-mono ${logs > 25 ? 'text-purple-600 animate-pulse' : 'text-purple-600'}`}
              >
                {logs} logs
              </div>
              <CardHeader className="text-lg font-semibold text-purple-600">
                📥 Export Logs
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500 mb-2">
                  Download platform usage logs and events.
                </p>
                <button
                  onClick={async () => {
                    const token = localStorage.getItem('sb-access-token');
                    const res = await fetch('/api/admin/logs-export-csv?table=log_events', {
                      method: 'POST',
                      headers: { Authorization: `Bearer ${token}` },
                    });
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'logs-export.csv';
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="mt-2 text-xs text-blue-600 underline hover:text-blue-700"
                >
                  Download Logs CSV
                </button>
                <button
                  onClick={async () => {
                    if (!confirm('Are you sure you want to clear all logs?')) return;
                    const token = localStorage.getItem('sb-access-token');
                    const res = await fetch('/api/admin/clear-logs', {
                      method: 'POST',
                      headers: { Authorization: `Bearer ${token}` },
                    });
                    const result = await res.json();

                    if (res.ok) {
                      alert('Logs cleared successfully');
                      setLogs(0);
                    } else {
                      alert(`Failed to clear logs: ${result.error}`);
                    }
                  }}
                  className="mt-2 text-xs text-red-500 underline hover:text-red-600"
                >
                  Clear Logs
                </button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
