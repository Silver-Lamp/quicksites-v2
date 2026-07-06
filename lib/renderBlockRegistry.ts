// lib/renderBlockRegistry.ts
import * as React from 'react';
import type { JSX } from 'react';
import type { BlockType } from '@/types/blocks';
import HeroRender from '@/components/admin/templates/render-blocks/hero';
import { resolveCanonicalType } from '@/lib/blockRegistry.core';

type BlockRenderer = (props: any) => JSX.Element | null;

// helper: wrap named exports into a default BlockRenderer
const wrap = (Comp: any) => (props: any) =>
  React.createElement(Comp, { content: props?.content ?? props, ...props });

// ElectInfo loaders
const loadCandidateHero         = () => import('@/components/blocks/candidate/hero')                .then(m => ({ default: wrap(m.CandidateHeroBlock) }));
const loadCandidateAbout        = () => import('@/components/blocks/candidate/about')               .then(m => ({ default: wrap(m.CandidateAboutBlock) }));
const loadCandidateIssues       = () => import('@/components/blocks/candidate/issues-grid')         .then(m => ({ default: wrap(m.CandidateIssuesGridBlock) }));
const loadCandidateEndorsements = () => import('@/components/blocks/candidate/endorsements')        .then(m => ({ default: wrap(m.CandidateEndorsementsBlock) }));
const loadCandidateEvents       = () => import('@/components/blocks/candidate/events')              .then(m => ({ default: wrap(m.CandidateEventsBlock) }));
const loadCandidateStay         = () => import('@/components/blocks/candidate/stay-connected')      .then(m => ({ default: wrap(m.CandidateStayConnectedBlock) }));
const loadCandidatePrintQR      = () => import('@/components/blocks/candidate/print-qr')            .then(m => ({ default: wrap(m.CandidatePrintQRBlock) }));
const loadCandidateDonate       = () => import('@/components/blocks/candidate/donate')              .then(m => ({ default: wrap(m.CandidateDonateBlock) }));
const loadCandidateVolunteer    = () => import('@/components/blocks/candidate/volunteer')           .then(m => ({ default: wrap(m.CandidateVolunteerBlock) }));
const loadPublicQrInfo          = () => import('@/components/blocks/candidate/public-qr-info')      .then(m => ({ default: wrap(m.PublicQrInfoBlock) }));
const loadPublicQrSidebar       = () => import('@/components/blocks/candidate/public-qr-sidebar')   .then(m => ({ default: wrap(m.PublicQrSidebarBlock) }));

const LOCAL_ALIASES: Record<string, BlockType | string> = {
  'exterior_agency': 'exterior_agency',
  'exterior_cleaning_agency': 'exterior_agency',
  'exterior-cleaning-agency': 'exterior_agency',
  'pnw_prestige': 'exterior_agency',
  // ElectInfo (optional)
  'candidate-hero': 'candidate_hero',
  'candidate-about': 'candidate_about',
  'candidate-issues-grid': 'candidate_issues_grid',
  'candidate-endorsements': 'candidate_endorsements',
  'candidate-events': 'candidate_events',
  'candidate-stay-connected': 'candidate_stay_connected',
  'candidate-print-qr': 'candidate_print_qr',
  'candidate-donate': 'candidate_donate',
  'candidate-volunteer': 'candidate_volunteer',
  'public-qr-info': 'public_qr_info',
  'public-qr-sidebar': 'public_qr_sidebar',
};

function isLiveSite(props: any) {
  return !!(
    props?.renderContext === 'site' ||
    props?.__site ||
    props?.site ||
    props?.publicRender ||
    props?.isLiveSite ||
    (props?.template && (props.template as any).is_site === true)
  );
}

export const STATIC_RENDERERS: Partial<Record<BlockType, BlockRenderer>> = {
  hero: HeroRender,
};

/** one loader reused for all three keys */
const loadExteriorAgency = () =>
  import('@/components/sites/render-blocks/exterior-cleaning-agency').then((mod) => ({
    default: (props: any) =>
      React.createElement((mod as any).default, {
        content: props?.content ?? props,
      }),
  }));

export const DYNAMIC_RENDERERS: Record<
  Exclude<BlockType, keyof typeof STATIC_RENDERERS>,
  () => Promise<{ default: BlockRenderer }>
> = {
  /** 🔑 register canonical + aliases */
  exterior_agency: loadExteriorAgency,
  exterior_cleaning_agency: loadExteriorAgency,
  pnw_prestige: loadExteriorAgency,

  text:   () => import('@/components/admin/templates/render-blocks/text'),
  image:  () => import('@/components/admin/templates/render-blocks/image'),
  video:  () => import('@/components/admin/templates/render-blocks/video'),
  audio:  () => import('@/components/admin/templates/render-blocks/audio'),
  quote:  () => import('@/components/admin/templates/render-blocks/quote'),
  button: () => import('@/components/admin/templates/render-blocks/button'),
  grid:   () => import('@/components/admin/templates/render-blocks/grid'),
  services: () =>
    import('@/components/admin/templates/render-blocks/services').then((mod) => ({
      default: (props: any) =>
        React.createElement(mod.default as any, {
          ...props,
          services: props?.services ?? props?.template?.services ?? [],
        }),
    })),
  cta:          () => import('@/components/admin/templates/render-blocks/cta'),
  testimonial:  () => import('@/components/admin/templates/render-blocks/testimonial'),
  footer:       () => import('@/components/admin/templates/render-blocks/footer'),
  service_areas:() => import('@/components/admin/templates/render-blocks/service-areas'),
  header:       () => import('@/components/admin/templates/render-blocks/header'),
  faq:          () => import('@/components/admin/templates/render-blocks/faq'),
  contact_form: () => import('@/components/admin/templates/render-blocks/contact-form'),
  hours:        () => import('@/components/admin/templates/render-blocks/hours'),
  menu:         () => import('@/components/admin/templates/render-blocks/menu'),
  location:     () => import('@/components/admin/templates/render-blocks/location'),
  products_grid: () => import('@/components/admin/templates/render-blocks/products-grid'),
  service_offer: async () => ({
    default: () =>
      React.createElement(
        'div',
        { className: 'border rounded-md p-3 bg-amber-50 text-sm' },
        React.createElement('b', null, 'Service Offer'),
        ' — renderer coming soon.'
      ),
  }),
  scheduler: async () => {
    const [AdminPreview, SiteLive] = await Promise.all([
      import('@/components/admin/templates/render-blocks/scheduler'),
      import('@/components/sites/render-blocks/scheduler'),
    ]);
    return {
      default: (props: any) => {
        const live = isLiveSite(props);
        const Comp: any = live ? SiteLive.default : AdminPreview.default;
        return React.createElement(Comp, { ...props, previewOnly: !live });
      },
    };
  },

  // ElectInfo
  candidate_hero: loadCandidateHero,
  candidate_about: loadCandidateAbout,
  candidate_issues_grid: loadCandidateIssues,
  candidate_endorsements: loadCandidateEndorsements,
  candidate_events: loadCandidateEvents,
  candidate_stay_connected: loadCandidateStay,

  // Admin-only (self-hides on public via its own prop/route check)
  candidate_print_qr: loadCandidatePrintQR,

  // Public QR helpers
  candidate_donate: loadCandidateDonate,
  candidate_volunteer: loadCandidateVolunteer,
  public_qr_info: loadPublicQrInfo,
  public_qr_sidebar: loadPublicQrSidebar,
} as const;

/** Resolve alias → canonical */
export function resolveRendererType(input: string): BlockType | null {
  const pre = (LOCAL_ALIASES[input] as string) ?? input;
  const t = resolveCanonicalType(pre);
  return t ?? (pre === 'exterior_agency' ? ('exterior_agency' as BlockType) : null);
}

export function getStaticRenderer(input: string): BlockRenderer | undefined {
  const t = resolveRendererType(input);
  return t ? STATIC_RENDERERS[t] : undefined;
}
export function getDynamicRenderer(
  input: string
): (() => Promise<{ default: BlockRenderer }>) | undefined {
  const t = resolveRendererType(input);
  if (!t) return undefined;
  if (t in STATIC_RENDERERS) return undefined;
  return (DYNAMIC_RENDERERS as any)[t];
}
export async function loadRenderer(
  input: string
): Promise<{ default: BlockRenderer } | null> {
  const s = getStaticRenderer(input);
  if (s) return { default: s };
  const d = getDynamicRenderer(input);
  if (!d) return null;
  return d();
}
