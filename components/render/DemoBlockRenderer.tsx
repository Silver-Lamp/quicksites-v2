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

type Block =
  | { type: 'candidate_hero'; content: any }
  | { type: 'candidate_about'; content: any }
  | { type: 'candidate_issues_grid'; content: any }
  | { type: 'candidate_endorsements'; content: any }
  | { type: 'candidate_events'; content: any }
  | { type: 'candidate_stay_connected'; content: any }
  | { type: 'public_qr_info'; content: any }
  | { type: 'public_qr_sidebar'; content: any };

export default function DemoBlockRenderer({ blocks }: { blocks: Block[] }) {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-white">
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'candidate_hero':          return <CandidateHeroBlock         key={i} content={b.content} />;
          case 'candidate_about':         return <CandidateAboutBlock        key={i} content={b.content} />;
          case 'candidate_issues_grid':   return <CandidateIssuesGridBlock   key={i} content={b.content} />;
          case 'candidate_endorsements':  return <CandidateEndorsementsBlock key={i} content={b.content} />;
          case 'candidate_events':        return <CandidateEventsBlock       key={i} content={b.content} />;
          case 'candidate_stay_connected':return <CandidateStayConnectedBlock key={i} content={b.content} />;
          case 'public_qr_info':          return <PublicQrInfoBlock          key={i} content={b.content} />;
          case 'public_qr_sidebar':       return <PublicQrSidebarBlock       key={i} content={b.content} />;
          default:
            return <div key={i} className="p-4 text-sm text-red-600">Unknown block: {(b as any).type}</div>;
        }
      })}
      <footer className="border-t py-10 text-center text-sm text-gray-500 dark:border-gray-800">
        Demo page • Replace with your real DynamicBlockRenderer when ready
      </footer>
    </div>
  );
}
