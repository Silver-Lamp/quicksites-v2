import DemoBlockRenderer from '@/components/render/DemoBlockRenderer';

export const dynamic = 'force-static';

export default function CandidateDemoPage() {
  const slug = 'alex-rivera';
  const longUrl  = `http://localhost:3000/candidate/demo`;  // or use PUBLIC_BASE_URL
  const shortUrl = `http://localhost:3000/c/ar`;             // replace once minted

  const blocks = [
    {
      type: 'candidate_hero',
      content: {
        photoUrl: 'https://images.unsplash.com/photo-1607746882042-944635dfe10e?auto=format&fit=crop&w=400&q=80',
        name: 'Alex Rivera',
        office: 'School Board, District 3',
        city: 'Renton, WA',
        tagline: 'Focused on students, transparency, and community growth.',
        url: longUrl,
        shortUrl,
        ctaDonateHref: 'https://donate.stripe.com/test_123',
        ctaVolunteerHref: 'mailto:team@electinfo.org',
        showDownloadQR: false,
      },
    },
    {
      type: 'candidate_about',
      content: {
        markdown:
          'I’ve been a teacher and parent advocate for over a decade. My goal is to ensure every child has access to safe classrooms, quality teachers, and modern learning tools.',
      },
    },
    {
      type: 'candidate_issues_grid',
      content: {
        items: [
          { title: 'Student Wellness', desc: 'Investing in mental health and safe, inclusive campuses.' },
          { title: 'STEM Access', desc: 'Expanding programs to prepare students for future careers.' },
          { title: 'Fiscal Transparency', desc: 'Ensuring district funds are used responsibly and openly.' },
        ],
      },
    },
    {
      type: 'candidate_endorsements',
      content: {
        items: [
          { org: 'Teachers Association', quote: 'Champion for equitable education funding.' },
          { org: 'Parent Advocacy Network', quote: 'A tireless advocate for transparency and community input.' },
          { org: 'Local Business Council', quote: 'Committed to preparing students for tomorrow’s workforce.' },
        ],
      },
    },
    {
      type: 'candidate_events',
      content: {
        items: [
          { title: 'Community Town Hall', dateISO: '2025-10-25T18:00:00-07:00', venue: 'Renton Community Center', blurb: 'Discuss school safety and budget.' },
          { title: 'Meet & Greet Coffee Chat', dateISO: '2025-11-02T10:00:00-07:00', venue: 'Downtown Cafe' },
          { title: 'School Board Candidate Forum', dateISO: '2025-11-10T19:00:00-07:00', venue: 'Renton High School Auditorium' },
        ],
      },
    },
    {
      type: 'candidate_stay_connected',
      content: { headline: 'Stay Connected', showZip: true, candidateSlug: slug },
    },
    { type: 'public_qr_info', content: { longUrl, shortUrl, caption: 'Scan for details', size: 120, align: 'center', showLinkText: true } },
    { type: 'public_qr_sidebar', content: { longUrl, shortUrl, caption: 'Scan to learn more', size: 128, side: 'right', sticky: true, topOffsetPx: 24, hideOnMobile: true, breakpoint: 'lg', widthPx: 260 } },
  ] as const;

  return <DemoBlockRenderer blocks={blocks as any} />;
}
