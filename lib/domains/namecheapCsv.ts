// lib/domains/namecheapCsv.ts
//
// Parse the Namecheap "Domain List" CSV export. Pure — no I/O, no DB — so the reconcile script is a
// thin shell over it and the parsing is testable on its own.
//
// ⚠️ THE DATE PARSER IS THE DANGEROUS PART. Its output becomes `owned_domains.expires_at`, which
// feeds `projectDomainSpendByExpiry` — the "lumpy truth" renewal forecast. A silently-wrong date
// does not error; it moves a renewal into the wrong month and the graph still looks plausible. So it
// returns **null** rather than guessing, and null degrades to the amortized projection — visibly
// less precise, instead of confidently wrong.

export type NamecheapRow = {
  domain: string;
  status: string;
  autoRenew: boolean;
  expiresAt: string | null;
};

/** "Jul 11 2027" → ISO, or null when the cell is not that shape. */
export function parseNamecheapDate(s: string): string | null {
  const m = /^([A-Za-z]{3})\s+(\d{1,2})\s+(\d{4})$/.exec((s || '').trim());
  if (!m) return null;
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const mi = months.indexOf(m[1].toLowerCase());
  if (mi < 0) return null;
  return `${m[3]}-${String(mi + 1).padStart(2, '0')}-${m[2].padStart(2, '0')}T00:00:00+00:00`;
}

export function parseCsv(text: string): NamecheapRow[] {
  return text
    .trim()
    .split('\n')
    .slice(1)
    .map((l) => l.split(','))
    .filter((c) => c.length >= 5 && c[0].trim())
    .map((c) => ({
      domain: c[0].trim().toLowerCase(),
      status: c[2].trim(),
      autoRenew: c[3].trim().toUpperCase() === 'ON',
      expiresAt: parseNamecheapDate(c[4]),
    }));
}
