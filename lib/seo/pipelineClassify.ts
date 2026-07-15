// lib/seo/pipelineClassify.ts
//
// Pure classification for a readiness-pipeline step result — split out from
// runReadinessPipeline (which imports the DB client) so it's unit-testable in isolation.

export type PipelineStepStatus = 'ran' | 'satisfied' | 'skipped' | 'noop' | 'error';

export type StepClassifiable = { changed?: boolean; reason?: string; error?: string };

/** Turn a runner result into a step status. */
export function classifyStep(result: StepClassifiable): PipelineStepStatus {
  if (result.error) return 'error';
  if (result.changed) return 'ran';
  if (result.reason === 'already' || result.reason === 'already_exists') return 'satisfied';
  return 'noop';
}
