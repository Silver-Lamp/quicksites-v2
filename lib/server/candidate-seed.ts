import type { z } from "zod";

/** simple slugify */
export function toSlug(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 80);
}

type SeedArgs = {
  name: string;
  office: string;
  city: string;
  photoUrl?: string;
  baseUrl: string; // PUBLIC_BASE_URL or http://localhost:3000
  slug: string;
  shortUrl?: string; // we’ll fill this after minting
};

export function buildCandidateBlocks(args: SeedArgs) {
  const longUrl = `${args.baseUrl.replace(/\/$/, "")}/candidate/${args.slug}`;
  return {
    blocks: [
      {
        type: "candidate_hero",
        content: {
          photoUrl: args.photoUrl || "",
          name: args.name,
          office: args.office,
          city: args.city,
          tagline: "Focused on students, transparency, and community growth.",
          url: longUrl,
          shortUrl: args.shortUrl,         // filled after shorten
          ctaDonateHref: "",
          ctaVolunteerHref: "",
          showDownloadQR: false
        }
      },
      {
        type: "candidate_about",
        content: {
          markdown:
            `I’ve been a community advocate for over a decade. My goal is to ensure every child has access to safe classrooms, great teachers, and modern learning tools.`,
        }
      },
      {
        type: "candidate_issues_grid",
        content: {
          items: [
            { title: "Student Wellness", desc: "Investing in mental health and safe, inclusive campuses." },
            { title: "STEM Access",      desc: "Expanding programs to prepare students for future careers." },
            { title: "Fiscal Transparency", desc: "Ensuring district funds are used responsibly and openly." },
          ]
        }
      },
      {
        type: "candidate_endorsements",
        content: {
          items: [
            { org: "Teachers Association", quote: "Champion for equitable education funding." },
            { org: "Parent Advocacy Network", quote: "A tireless advocate for transparency and community input." }
          ]
        }
      },
      {
        type: "candidate_events",
        content: {
          items: []
        }
      },
      {
        type: "candidate_stay_connected",
        content: {
          headline: "Stay Connected",
          showZip: true,
          candidateSlug: args.slug
        }
      }
    ]
  };
}
