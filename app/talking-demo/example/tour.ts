// app/talking-demo/example/tour.ts
//
// The baked Talking Demo Tier 2 render for the example site (Field & Oak Coffee Roasters).
// Generated once via HJ's /api/partner/talking-demo/render (want_mp4:true, page_url = this page) and
// stored here — the URLs are permanent + unsigned (contract: talking-demo-render.md §Permanence), so
// the page renders the tour with zero runtime render cost or dependency. Regenerate to refresh.
//
// instance_ref: talking-demo-example-field-oak-v1

import type { RenderedStep } from '@/lib/talkingDemo/types';

const STORE = 'https://pfyocleyejmtxmbxrdcm.supabase.co/storage/v1/object/public/season-assets';

export const EXAMPLE_TOUR: {
  mp4_url: string;
  poster_url: string;
  steps: RenderedStep[];
} = {
  mp4_url: `${STORE}/talking-demo/video/29311359-28ef-4cbd-9fde-37f1f1ea6ba9.mp4`,
  poster_url: `${STORE}/talking-demo/video/29311359-28ef-4cbd-9fde-37f1f1ea6ba9.png`,
  steps: [
    {
      caption: 'Welcome',
      say: 'Welcome to Field and Oak Coffee Roasters — a small-batch coffee roaster in the heart of Cedar Hollow.',
      audio_url: `${STORE}/studio-demo/narration/485fece7b9ae731a8058a002.mp3`,
    },
    {
      caption: 'What we do',
      say: 'They roast single-origin beans in small batches, ship fresh coffee on a subscription you can pause anytime, and supply a handful of neighborhood cafes.',
      audio_url: `${STORE}/studio-demo/narration/7bbdc1b71e2893f6ad4436e1.mp3`,
    },
    {
      caption: 'Visit the roastery',
      say: 'You will find them at 214 Oak Street. Street parking out front, and the roaster is usually going in the back — just follow your nose.',
      audio_url: `${STORE}/studio-demo/narration/dd21375e496ba65ed07a699b.mp3`,
    },
    {
      caption: 'Come on in',
      say: 'Open weekdays seven to five, plus Saturdays. Start a subscription online, or just stop by for a very good cortado.',
      audio_url: `${STORE}/studio-demo/narration/af85eb51f4979bb48b2eab24.mp3`,
    },
  ],
};
