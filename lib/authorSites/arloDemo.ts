// lib/authorSites/arloDemo.ts
//
// The Arlo V. demo package — HiveJournal's prod-validated sellable-artifacts
// payload + persona author profile, VERBATIM from crosstalk message
// 20260717-050917 (asset URLs HEAD-verified 200 the same day). Single source for
// (a) the standing contract test and (b) the seed-author-demo storefront — the
// site both products show real authors at HJ Author Sites launch (ideas.md §1).
//
// Honesty rules: Arlo V. is a FICTIONAL author (an AI persona). The labeling
// line below is HJ's, agreed verbatim, and MUST render on the demo site.

import type { HjArtifactsPayload } from './importArtifacts';

export const ARLO_PAYLOAD: HjArtifactsPayload = {
  work: {
    id: '805492fc-7ec9-4496-857b-07886ec81ed4',
    title: 'The Flickering Screen',
    author_name: 'Jordan K.', // profile name; the demo brands as the persona display_name below
  },
  artifacts: [
    {
      artifact_id: 'art_805492fc-7ec9-4496-857b-07886ec81ed4_paperback',
      type: 'paperback',
      provider: 'lulu',
      status: 'ready',
      title: 'The Flickering Screen',
      description:
        'In a dystopian society where every aspect of life is broadcast, a group of individuals begins questioning the authenticity of their existence. As they uncover layers of reality, they must decide whether to embrace their roles or rebel against the unseen forces controlling them.',
      cover_image_url:
        'https://pfyocleyejmtxmbxrdcm.supabase.co/storage/v1/object/public/season-assets/posters/805492fc-7ec9-4496-857b-07886ec81ed4/1779472430662-n4pxlk.png',
      spec: {
        interiorUrl:
          'https://pfyocleyejmtxmbxrdcm.supabase.co/storage/v1/object/public/season-assets/print/805492fc-7ec9-4496-857b-07886ec81ed4/export-interior.pdf',
        coverUrl:
          'https://pfyocleyejmtxmbxrdcm.supabase.co/storage/v1/object/public/season-assets/print/805492fc-7ec9-4496-857b-07886ec81ed4/export-cover.pdf',
        pageCount: 40,
        podPackageId: '0600X0900BWSTDPB060UW444MXX',
      },
    },
    {
      artifact_id: 'art_805492fc-7ec9-4496-857b-07886ec81ed4_audiobook',
      type: 'audiobook',
      provider: 'digital',
      status: 'ready',
      title: 'The Flickering Screen',
      description:
        'In a dystopian society where every aspect of life is broadcast, a group of individuals begins questioning the authenticity of their existence. As they uncover layers of reality, they must decide whether to embrace their roles or rebel against the unseen forces controlling them.',
      cover_image_url:
        'https://pfyocleyejmtxmbxrdcm.supabase.co/storage/v1/object/public/season-assets/posters/805492fc-7ec9-4496-857b-07886ec81ed4/1779472430662-n4pxlk.png',
      spec: {
        asset_url:
          'https://pfyocleyejmtxmbxrdcm.supabase.co/storage/v1/object/public/season-assets/audio/805492fc-7ec9-4496-857b-07886ec81ed4/book-full.mp3',
      },
    },
  ],
};

export const ARLO_PERSONA = {
  display_name: 'Arlo V.',
  bio: "I'm Arlo, a dynamic marketing strategist with a passion for unlocking growth through innovative channel strategies and persuasive copy. I thrive on turning insights into actionable plans that drive results.",
  mbti: 'ENTP',
  writing_style: 'Engaging and insightful, with a knack for weaving data into compelling narratives.',
  location: 'Miami, FL, US',
  avatar_url: null as string | null,
};

/** HJ's labeling line, agreed verbatim — MUST render on the demo storefront. */
export const ARLO_LABELING_LINE =
  "Arlo V. is a fictional author — an AI persona from the HiveJournal platform. This storefront is a demonstration; the book and audiobook are real, machine-narrated artifacts of the persona's novel.";
