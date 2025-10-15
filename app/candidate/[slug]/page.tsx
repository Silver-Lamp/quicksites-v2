// app/candidate/[slug]/page.tsx
import DemoBlockRenderer from '@/components/render/DemoBlockRenderer';
import { getServerSupabase } from "@/lib/supabase/server";

export const dynamic = 'force-dynamic';
export const runtime  = "nodejs";

async function getTemplateByCandidateSlug(slug: string) {
  // TODO: replace with your real DB/template fetch.
  // For now, route 'demo' to the same blocks as /candidate/demo.
  if (slug === 'demo') {
    const base = process.env.PUBLIC_BASE_URL || 'http://localhost:3000';
    const longUrl  = `${base}/candidate/demo`;
    const shortUrl = `${base}/c/ar`; // replace once minted

    return {
      blocks: [
        { type: 'candidate_hero',
          content: { photoUrl: 'https://images.unsplash.com/photo-1607746882042-944635dfe10e?auto=format&fit=crop&w=400&q=80',
                     name: 'Alex Rivera', office: 'School Board, District 3', city: 'Renton, WA',
                     tagline: 'Focused on students, transparency, and community growth.',
                     url: longUrl, shortUrl, showDownloadQR: true } },
        { type: 'candidate_about',        content: { markdown: 'Short bio here…' } },
        { type: 'candidate_issues_grid',  content: { items: [{ title:'Wellness',desc:'…'},{ title:'STEM',desc:'…'},{ title:'Transparency',desc:'…'}] } },
        { type: 'candidate_endorsements', content: { items: [{org:'Teachers Assoc.',quote:'…'}] } },
        { type: 'candidate_events',       content: { items: [{ title:'Town Hall', dateISO: new Date().toISOString(), venue:'Community Center'}] } },
        { type: 'candidate_stay_connected', content: { headline:'Stay Connected', showZip:true, candidateSlug: slug } },
      ],
    };
  }
  return null;
}

export default async function CandidatePage({ params }: { params: { slug: string } }) {
    const supabase = await getServerSupabase({ serviceRole: true });
    const { data, error } = await supabase
      .from("candidate_pages")
      .select("blocks")
      .eq("slug", params.slug)
      .maybeSingle();
  
    if (error || !data) return <div className="p-6">Not found</div>;
    return <DemoBlockRenderer blocks={(data.blocks?.blocks || []) as any} />;
  }