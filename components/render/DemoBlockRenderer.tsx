'use client';
import * as React from 'react';

import { CandidateHeroBlock } from '@/components/blocks/candidate/hero';
import { CandidateAboutBlock } from '@/components/blocks/candidate/about';
import { CandidateIssuesGridBlock } from '@/components/blocks/candidate/issues-grid';
import { CandidateEndorsementsBlock } from '@/components/blocks/candidate/endorsements';
import { CandidateEventsBlock } from '@/components/blocks/candidate/events';
import { CandidateStayConnectedBlock } from '@/components/blocks/candidate/stay-connected';
import { PublicQrInfoBlock } from '@/components/blocks/candidate/public-qr-info';
import { PublicQrSidebarBlock } from '@/components/blocks/candidate/public-qr-sidebar';
import { CandidateDonateBlock } from '@/components/blocks/candidate/donate';
import { CandidateVolunteerBlock } from '@/components/blocks/candidate/volunteer';

import GatedFeature from '@/components/electinfo/GatedFeature';
import type { Entitlements } from '@/lib/electinfo/features';

type Block =
  | { type: 'candidate_hero'; content: any }
  | { type: 'candidate_about'; content: any }
  | { type: 'candidate_issues_grid'; content: any }
  | { type: 'candidate_endorsements'; content: any }
  | { type: 'candidate_events'; content: any }
  | { type: 'candidate_stay_connected'; content: any }
  | { type: 'candidate_donate'; content: any }
  | { type: 'candidate_volunteer'; content: any }
  | { type: 'public_qr_info'; content: any }
  | { type: 'public_qr_sidebar'; content: any };

type CTAPrefs = { allowText?: boolean; allowEmail?: boolean };

export default function DemoBlockRenderer({
  blocks,
  entitlements,
  siteId,
  slug,
  ctaPrefs,
}: {
  blocks: Block[];
  entitlements?: Entitlements;
  siteId?: string;
  slug?: string;
  ctaPrefs?: CTAPrefs; // ⬅️ new
}) {
  const allowText = !!ctaPrefs?.allowText;
  const allowEmail = !!ctaPrefs?.allowEmail;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-white">
      {/* Global vertical rhythm for sections */}
      <div className="space-y-10 md:space-y-12">
        {blocks.map((b, i) => {
          switch (b.type) {
            // Free blocks
            case 'candidate_hero':
              return (
                <CandidateHeroBlock
                  key={i}
                  content={b.content}
                  entitlements={entitlements}
                  siteId={siteId}
                  slug={slug}
                />
              );
            case 'candidate_about':
              return <CandidateAboutBlock key={i} content={b.content} />;
            case 'candidate_issues_grid':
              return <CandidateIssuesGridBlock key={i} content={b.content} />;

            // Gated: Endorsements
            case 'candidate_endorsements':
              return (
                <GatedFeature
                  key={i}
                  className="my-0"
                  feature="endorsements"
                  enabled={!!entitlements?.endorsements}
                  label="Endorsements"
                  siteId={siteId}
                  slug={slug}
                  variant="inline"
                  teaserMaxHeight={120}
                  blurb="Show trusted organizations and community leaders who stand behind this campaign."
                  benefits={['Logo + quote layout', 'Link to endorsers', 'Auto-sort by type']}
                  allowText={allowText}
                  allowEmail={allowEmail}
                >
                  <CandidateEndorsementsBlock content={b.content} />
                </GatedFeature>
              );

            // Gated: Events
            case 'candidate_events':
              return (
                <GatedFeature
                  key={i}
                  className="my-0"
                  feature="events"
                  enabled={!!entitlements?.events}
                  label="Upcoming Events"
                  siteId={siteId}
                  slug={slug}
                  variant="inline"
                  teaserMaxHeight={110}
                  blurb="List town halls, meet-and-greets, and forums—add to calendar in one tap."
                  benefits={['Date/venue formatting', 'Add to Apple/Google', 'Auto-archive past events']}
                  allowText={allowText}
                  allowEmail={allowEmail}
                >
                  <CandidateEventsBlock content={b.content} />
                </GatedFeature>
              );

            // Gated: Newsletter
            case 'candidate_stay_connected':
              return (
                <GatedFeature
                  key={i}
                  className="my-0"
                  feature="newsletter"
                  enabled={!!entitlements?.newsletter}
                  label="Subscribe to Updates"
                  siteId={siteId}
                  slug={slug}
                  variant="inline"
                  teaserMaxHeight={100}
                  blurb="Capture emails and ZIPs to mobilize supporters and send timely updates."
                  benefits={['Email + ZIP capture', 'CSV export', 'One-click consent copy']}
                  allowText={allowText}
                  allowEmail={allowEmail}
                >
                  <CandidateStayConnectedBlock content={b.content} />
                </GatedFeature>
              );

            // Gated: Donate
            case 'candidate_donate':
              return (
                <GatedFeature
                  key={i}
                  className="my-0"
                  feature="donations"
                  enabled={!!entitlements?.donations}
                  label="Donate"
                  siteId={siteId}
                  slug={slug}
                  variant="inline"
                  teaserMaxHeight={110}
                  blurb="Fuel outreach, events, and voter contact with a secure donation link."
                  benefits={['Stripe/ActBlue link', 'Suggested amounts', 'Compliance note']}
                  allowText={allowText}
                  allowEmail={allowEmail}
                >
                  <CandidateDonateBlock content={b.content} />
                </GatedFeature>
              );

            // Gated: Volunteer
            case 'candidate_volunteer':
              return (
                <GatedFeature
                  key={i}
                  className="my-0"
                  feature="volunteer"
                  enabled={!!entitlements?.volunteer}
                  label="Volunteer"
                  siteId={siteId}
                  slug={slug}
                  variant="inline"
                  teaserMaxHeight={110}
                  blurb="Recruit supporters for canvassing, phone banking, and yard signs."
                  benefits={['Name/Email collection', 'CSV export', 'Reply-to routing']}
                  allowText={allowText}
                  allowEmail={allowEmail}
                >
                  <CandidateVolunteerBlock content={b.content} />
                </GatedFeature>
              );

            // Free: QR helper blocks
            case 'public_qr_info':
              return <PublicQrInfoBlock key={i} content={b.content} />;
            case 'public_qr_sidebar':
              return <PublicQrSidebarBlock key={i} content={b.content} />;

            default:
              return (
                <div key={i} className="p-4 text-sm text-red-600">
                  Unknown block: {(b as any).type}
                </div>
              );
          }
        })}
      </div>

      <footer className="border-t py-10 text-center text-sm text-gray-500 dark:border-gray-800">
        Demo page • Replace with your real DynamicBlockRenderer when ready
      </footer>
    </div>
  );
}
