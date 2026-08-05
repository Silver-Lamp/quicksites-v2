import { markdownToPlainText, looksLikeMarkdown } from '../plainText';

describe('markdownToPlainText', () => {
  it('strips heading hashes but keeps the heading words', () => {
    expect(markdownToPlainText('# Volunteer Contributor Agreement')).toBe(
      'Volunteer Contributor Agreement\n',
    );
    expect(markdownToPlainText('### 1. Nature of the relationship')).toBe(
      '1. Nature of the relationship\n',
    );
  });

  it('strips emphasis markers without touching the words', () => {
    expect(markdownToPlainText('**Between:** Point Seven Studio LLC')).toBe(
      'Between: Point Seven Studio LLC\n',
    );
    expect(markdownToPlainText('The Contributor is a **volunteer**. This is **not** employment.')).toBe(
      'The Contributor is a volunteer. This is not employment.\n',
    );
  });

  it('keeps the TEXT of a blockquote — it is content, only the arrow is syntax', () => {
    // Our own template puts the "not legal advice" warning in a blockquote. Dropping it would
    // remove a disclaimer from a contract.
    expect(markdownToPlainText('> Not legal advice. Have an attorney review it.')).toBe(
      'Not legal advice. Have an attorney review it.\n',
    );
  });

  it('turns a horizontal rule into a paragraph break rather than a row of dashes', () => {
    expect(markdownToPlainText('A\n\n---\n\nB')).toBe('A\n\nB\n');
  });

  it('keeps the href of a link — dropping it would lose a term', () => {
    expect(markdownToPlainText('See [the runbook](https://example.com/x).')).toBe(
      'See the runbook (https://example.com/x).\n',
    );
  });

  it('never drops a word', () => {
    const md = [
      '# Title',
      '',
      '> ⚠️ **Not legal advice.** Have an attorney review it.',
      '',
      '---',
      '',
      '**Between:** Point Seven Studio LLC ("Project Owner")',
      '',
      '### 2. Assignment',
      'All code is assigned to the *Project Owner*.',
      '- first item',
      '- second item',
    ].join('\n');
    const out = markdownToPlainText(md);
    for (const word of [
      'Title', 'Not legal advice.', 'attorney', 'Between:', 'Point Seven Studio LLC',
      'Assignment', 'assigned', 'Project Owner', 'first item', 'second item',
    ]) {
      expect(out).toContain(word);
    }
    // And none of the syntax survives.
    expect(out).not.toMatch(/^#|\*\*|^>|^---$/m);
  });

  it('leaves already-plain text alone', () => {
    const plain = 'Between: Point Seven Studio LLC\n\nSection 1. You agree.\n';
    expect(markdownToPlainText(plain)).toBe(plain);
  });
});

describe('looksLikeMarkdown', () => {
  it('spots the constructs that would otherwise reach a signer as syntax', () => {
    expect(looksLikeMarkdown('# Heading')).toBe(true);
    expect(looksLikeMarkdown('**bold**')).toBe(true);
    expect(looksLikeMarkdown('> quote')).toBe(true);
    expect(looksLikeMarkdown('---')).toBe(true);
    expect(looksLikeMarkdown('[a](b)')).toBe(true);
  });

  it('does not cry wolf on ordinary contract prose', () => {
    // A check that fires on correct input trains you to skip its output.
    expect(looksLikeMarkdown('Section 1. The Contributor is a volunteer.')).toBe(false);
    expect(looksLikeMarkdown('Payment is due 30 days after the invoice date.')).toBe(false);
  });
});
