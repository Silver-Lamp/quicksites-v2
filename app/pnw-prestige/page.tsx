import ExteriorCleaningAgency, { PNW_PRESTIGE_TEMPLATE_CONFIG as cfg } from '@/components/sites/render-blocks/exterior-cleaning-agency';
export default function Page() {
  const content = (cfg.pages[0].blocks[0] as any).props.content;
  return <ExteriorCleaningAgency content={content} />;
}
