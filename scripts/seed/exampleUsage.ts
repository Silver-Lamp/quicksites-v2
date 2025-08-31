import { attachTemplateAiEstimate } from './withAiEstimates';

export async function seedOneTemplateAndEstimate(tmpl: any) {
  // 1) insert your template first (existing logic)
  // const template = await insertTemplate(tmpl)
  const template = tmpl; // assume we have id

  // 2) attach estimate
  const est = await attachTemplateAiEstimate(template, { profileCode: 'RICH' });
  console.log('AI estimate for template', template.id, est);
}
