/**
 * Token assumptions are conservative estimates per action. 
 * Tune these over time; UI exposes them for what‑if scenarios.
 */
export type BlockAssumption = {
    prompt_in: number;   // expected input tokens (prompt + system + context)
    gen_out: number;     // expected output tokens
  };
  
  export type AssumptionProfile = {
    code: 'BASIC'|'RICH'|'MAX';
    label: string;
    // per block type; unknown types default to 0/0
    blocks: Record<string, BlockAssumption>;
    // page‑level extras (e.g., SEO/meta, schema, etc.)
    perPage?: BlockAssumption;
    // template‑level extras (site‑wide synopsis, brand voice crafting, etc.)
    perTemplate?: BlockAssumption;
    // global multipliers
    regenerationFactor?: number; // e.g., 1.0 = single pass, 1.5 = some retries
  };
  
  const ZERO: BlockAssumption = { prompt_in: 0, gen_out: 0 };
  
  export const ASSUMPTIONS: Record<AssumptionProfile['code'], AssumptionProfile> = {
    BASIC: {
      code: 'BASIC',
      label: 'Lean (single‑pass, short copy)',
      blocks: {
        hero: { prompt_in: 300, gen_out: 180 },
        services: { prompt_in: 250, gen_out: 220 },   // per service item handled in estimator
        testimonials: { prompt_in: 180, gen_out: 140 },
        page_header: { prompt_in: 120, gen_out: 90 },
        contact_form: ZERO,
        service_areas: { prompt_in: 200, gen_out: 160 },
        faq: { prompt_in: 220, gen_out: 240 },
        about: { prompt_in: 260, gen_out: 240 },
      },
      perPage: { prompt_in: 160, gen_out: 140 },      // SEO title/desc, og text
      perTemplate: { prompt_in: 240, gen_out: 160 },  // brand voice brief
      regenerationFactor: 1.0,
    },
    RICH: {
      code: 'RICH',
      label: 'Rich (longer copy, a few regenerations)',
      blocks: {
        hero: { prompt_in: 450, gen_out: 280 },
        services: { prompt_in: 380, gen_out: 340 },
        testimonials: { prompt_in: 260, gen_out: 220 },
        page_header: { prompt_in: 200, gen_out: 140 },
        contact_form: ZERO,
        service_areas: { prompt_in: 300, gen_out: 260 },
        faq: { prompt_in: 340, gen_out: 360 },
        about: { prompt_in: 380, gen_out: 360 },
      },
      perPage: { prompt_in: 240, gen_out: 220 },
      perTemplate: { prompt_in: 360, gen_out: 240 },
      regenerationFactor: 1.25,
    },
    MAX: {
      code: 'MAX',
      label: 'Max (long form, retries, variants)',
      blocks: {
        hero: { prompt_in: 700, gen_out: 480 },
        services: { prompt_in: 560, gen_out: 500 },
        testimonials: { prompt_in: 420, gen_out: 360 },
        page_header: { prompt_in: 320, gen_out: 240 },
        contact_form: ZERO,
        service_areas: { prompt_in: 480, gen_out: 440 },
        faq: { prompt_in: 520, gen_out: 560 },
        about: { prompt_in: 600, gen_out: 560 },
      },
      perPage: { prompt_in: 380, gen_out: 360 },
      perTemplate: { prompt_in: 520, gen_out: 360 },
      regenerationFactor: 1.6,
    }
  };
  