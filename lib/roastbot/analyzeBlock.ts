export type UXWarning =
  | 'missing-cta'
  | 'missing-headline'
  | 'low-contrast'
  | 'short-text'
  | 'unlabeled-button';

export function analyzeBlock(type: string, content: any): UXWarning[] {
  const warnings: UXWarning[] = [];

  if (!content) return warnings;

  if (type === 'hero') {
    if (!content.headline || content.headline.trim().length < 5) {
      warnings.push('missing-headline');
    }
    if (!content.cta_text || !content.cta_link) {
      warnings.push('missing-cta');
    }
  }

  if (type === 'cta') {
    if (!content.label || content.label.length < 3) {
      warnings.push('unlabeled-button');
    }
  }

  if (type === 'quote' || type === 'text') {
    if (!content.value || content.value.length < 20) {
      warnings.push('short-text');
    }
  }

  if (type === 'hero' || type === 'cta') {
    if (
      content?.cta_text &&
      content?.background_color &&
      content?.text_color &&
      content.background_color === content.text_color
    ) {
      warnings.push('low-contrast');
    }
  }

  return warnings;
}
