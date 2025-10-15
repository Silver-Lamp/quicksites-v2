import { z } from "zod";

export const CandidateHeroSchema = z.object({
  photoUrl: z.string().url().nullish(),
  name: z.string(),
  office: z.string(),
  city: z.string(),
  tagline: z.string().optional(),
  url: z.string().url(),
  shortUrl: z.string().url().optional(),
  ctaDonateHref: z.string().url().optional(),
  ctaVolunteerHref: z.string().url().optional(),
  showDownloadQR: z.boolean().default(false),
});

export const CandidateAboutSchema = z.object({ markdown: z.string() });

export const CandidateIssuesSchema = z.object({
  items: z.array(z.object({ title: z.string(), desc: z.string() })).min(1).max(12),
});

export const CandidateEndorsementsSchema = z.object({
  items: z.array(z.object({ org: z.string(), quote: z.string() })),
});

export const CandidateEventsSchema = z.object({
  items: z.array(z.object({
    title: z.string(),
    dateISO: z.string(),
    venue: z.string(),
    blurb: z.string().optional(),
  })),
});

export const StayConnectedSchema = z.object({
  headline: z.string().default("Stay Connected"),
  showZip: z.boolean().default(true),
  candidateSlug: z.string(),
});

export type CandidateHero = z.infer<typeof CandidateHeroSchema>;
export type CandidateAbout = z.infer<typeof CandidateAboutSchema>;
export type CandidateIssues = z.infer<typeof CandidateIssuesSchema>;
export type CandidateEndorsements = z.infer<typeof CandidateEndorsementsSchema>;
export type CandidateEvents = z.infer<typeof CandidateEventsSchema>;
export type StayConnected = z.infer<typeof StayConnectedSchema>;
