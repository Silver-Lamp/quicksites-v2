'use client';
import { useEffect, useState } from 'react';
import { json } from '@/lib/api/json';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { generateBaseSlug } from '@/lib/slugHelpers';
import { useRef } from 'react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text).then(() => {
    alert('Link copied to clipboard!');
  });
};

export default function StarterPage() {
  const router = useRouter();
  const [bizName, setBizName] = useState('');
  const [location, setLocation] = useState('');
  const [slug, setSlug] = useState('');
  const [domain, setDomain] = useState('');
  const [template, setTemplate] = useState<any>(null);
  const [templateVersionId, setTemplateVersionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [generatingSlug, setGeneratingSlug] = useState(false);
  const [typedDomain, setTypedDomain] = useState('');
  const bizNameRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    bizNameRef.current?.focus();
  }, []);

  useEffect(() => {
    const searchParams = useSearchParams();
    const name = searchParams?.get('template') as string;
    if (!name) return;

    supabase
      .from('template_versions')
      .select('*')
      .eq('template_name', name)
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data, error }) => {
        if (error || !data?.length) {
          console.error('Template version load error:', error);
          setTemplate(null);
          setTemplateVersionId(null);
        } else {
          setTemplate(data[0]);
          setTemplateVersionId(data[0].id);
        }
      });
  }, [useSearchParams()?.get('template')]);

  useEffect(() => {
    if (!slug) return setSlugAvailable(null);
    const delay = setTimeout(async () => {
      const { data } = await supabase.from('sites').select('id').eq('slug', slug).maybeSingle();

      setSlugAvailable(!data);
    }, 400);

    return () => clearTimeout(delay);
  }, [slug]);

  // Debounced auto-slug/domain generation
  useEffect(() => {
    if (!bizName.trim()) return;

    setGeneratingSlug(true);
    const baseSlug = generateBaseSlug(bizName, location);
    const fullDomain = `${baseSlug}.com`;

    const delay = setTimeout(() => {
      setSlug(baseSlug);
      setDomain(fullDomain);

      // Typewriter effect
      let i = 0;
      const typeInterval = setInterval(() => {
        setTypedDomain(fullDomain.slice(0, i + 1));
        i++;
        if (i === fullDomain.length) {
          clearInterval(typeInterval);
          setGeneratingSlug(false);
        }
      }, 50); // typing speed in ms
    }, 300);

    return () => clearTimeout(delay);
  }, [bizName, location]);

  const claimIt = async () => {
    if (!templateVersionId) {
      alert('Template failed to load. Please choose a different template or try again.');
      return;
    }

    if (slugAvailable === false) {
      alert('That slug is already taken. Please choose another.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/sites/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_version_id: templateVersionId,
          business_name: bizName,
          location,
          domain,
          slug,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error('Create site error:', errorText);
        alert('Error creating site. Check console for details.');
        setLoading(false);
        return;
      }

      const site = await res.json();
      const slugToUse = site.slug ?? site.site_id;
      router.push(`/edit/${slugToUse}`);
    } catch (err) {
      console.error('Unexpected error in claimIt:', err);
      alert('Unexpected error. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto text-white p-6 space-y-6">
      <h1 className="text-3xl font-bold text-center">✨ Create Your QuickSite</h1>

      {template ? (
        <div className="bg-zinc-800 p-4 rounded shadow">
          <h2 className="text-xl font-semibold mb-1">{template.template_name}</h2>
          {template.thumbnail_url && (
            <img src={template.thumbnail_url} alt="Preview" className="rounded mb-3" />
          )}
          <p className="text-sm text-zinc-400 mb-2">{template.description}</p>
        </div>
      ) : (
        <p className="text-zinc-400 italic">Loading template preview...</p>
      )}

      <div className="space-y-4">
        <div>
          <label className="text-sm text-zinc-400">Business Name</label>
          <input
            ref={bizNameRef}
            value={bizName}
            onChange={(e) => setBizName(e.target.value)}
            className="w-full mb-3 p-2 rounded bg-zinc-800 text-white"
            placeholder="e.g. Towmanz"
          />
        </div>

        <div>
          <label className="text-sm text-zinc-400">Location (optional)</label>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full mb-3 p-2 rounded bg-zinc-800 text-white"
            placeholder="e.g. Auburn, WA"
          />
        </div>

        <div>
          <label className="text-sm text-zinc-400">Custom Slug (optional)</label>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-'))}
            className="w-full mb-1 p-2 rounded bg-zinc-800 text-white"
            placeholder="e.g. mytow-auburn"
          />
          {slug && slugAvailable !== null && (
            <p className={`text-sm ${slugAvailable ? 'text-green-400' : 'text-red-400'}`}>
              {slugAvailable ? '✅ Available' : '🚫 Already taken'}
            </p>
          )}
        </div>
        {/* {generatingSlug && ( */}
        {/* <div className="flex justify-center items-center gap-2 text-sm text-zinc-400"> */}
        {/* <svg className="animate-spin h-4 w-4 text-zinc-400" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
              />
            </svg> */}
        {/* Generating domain... */}
        {/* </div> */}
        {/* )} */}

        <div className="text-center space-y-2">
          {domain ? (
            <>
              <p className="text-zinc-300 text-sm">Suggested Domain:</p>
              <div className="text-lg font-mono font-bold tracking-wide">
                {typedDomain || (generatingSlug ? '...' : domain)}
              </div>
              {slug && (
                <>
                  <div className="text-sm text-zinc-400 flex items-center justify-center gap-2">
                    <span>Preview:</span>
                    <code className="text-white px-2 py-1 bg-zinc-700 rounded text-sm">
                      /edit/{slug}
                    </code>
                    <button
                      onClick={() => copyToClipboard(`${window.location.origin}/edit/${slug}`)}
                      className="text-blue-400 hover:underline text-xs"
                    >
                      Copy
                    </button>
                  </div>

                  <div className="text-sm text-zinc-400 flex flex-col items-center gap-1 mt-2">
                    <span>Public Site:</span>
                    <code className="text-white px-2 py-1 bg-zinc-700 rounded text-sm">
                      https://{slug}.quicksites.ai
                    </code>
                    <button
                      onClick={() => copyToClipboard(`https://${slug}.quicksites.ai`)}
                      className="text-blue-400 hover:underline text-xs"
                    >
                      Copy Public Link
                    </button>
                  </div>
                </>
              )}

              <button
                onClick={claimIt}
                disabled={loading}
                className="mt-2 px-4 py-2 bg-green-600 rounded text-white font-medium hover:bg-green-700"
              >
                🚀 Claim It
              </button>
            </>
          ) : (
            bizName.trim() !== '' && (
              <p className="text-sm text-red-400">
                ⚠️ Please complete the business name and location to generate a domain.
              </p>
            )
          )}
        </div>
      </div>
    </div>
  );
}
