// The `evidence_claims` block derives every grade at render from lib/evidence records; the block
// content stores only which topic and claims to show. Silent in public when unconfigured.
import React from 'react';
import { render } from '@testing-library/react';
import EvidenceClaims from '@/components/admin/templates/render-blocks/evidence-claims';
import { blockContentSchemaMap } from '@/admin/lib/zod/blockSchema';
import { DEFAULT_BLOCK_CONTENT } from '@/lib/blocks/defaultBlockContent';

const block = (c: Record<string, unknown>) => ({ type: 'evidence_claims', _id: 'e1', content: c } as any);

describe('evidence_claims block', () => {
  it('its default content validates and stores no grade', () => {
    expect(blockContentSchemaMap.evidence_claims.schema.safeParse(DEFAULT_BLOCK_CONTENT.evidence_claims).success).toBe(true);
    expect(JSON.stringify(DEFAULT_BLOCK_CONTENT.evidence_claims)).not.toMatch(/grade|established|promising/i);
  });
  it('renders nothing in public when no topic is set', () => {
    const { container } = render(<EvidenceClaims block={block({ topic: '' })} />);
    expect(container.innerHTML).toBe('');
  });
  it('mullein: the cough and smokers claims render "No real evidence", computed from the records', () => {
    const { container } = render(<EvidenceClaims block={block({ topic: 'mullein', claim_ids: ['cough', 'smokers-lungs'] })} />);
    const grades = Array.from(container.querySelectorAll('[data-grade]')).map((n) => n.getAttribute('data-grade'));
    expect(grades).toEqual(['no_evidence', 'no_evidence']);
    expect(container.textContent).toMatch(/evidence checked 2026-10-21/i);
  });
  it('a grade typed into the block content is ignored — the records decide', () => {
    const { container } = render(<EvidenceClaims block={block({ topic: 'mullein', claim_ids: ['cough'], grade: 'established' })} />);
    expect(container.querySelector('[data-grade]')?.getAttribute('data-grade')).toBe('no_evidence');
  });
  it('shows the study sentence, linked to its source, where a claim has evidence', () => {
    const { container } = render(<EvidenceClaims block={block({ topic: 'mullein', claim_ids: ['episiotomy-cream'] })} />);
    const a = container.querySelector('a[href="https://pubmed.ncbi.nlm.nih.gov/34103042/"]');
    expect(a?.textContent).toMatch(/Double-blind randomized trial, 93 people/);
  });
});
