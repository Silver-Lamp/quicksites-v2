export function renderVersionDiff(base: any, compare: any): string {
  const baseEntries = Object.entries(base);
  const compareEntries = Object.entries(compare);
  const allKeys = Array.from(
    new Set([...baseEntries.map(([k]) => k), ...compareEntries.map(([k]) => k)])
  );
  const grouped = {
    branding: allKeys.filter((k) => k.includes('brand')),
    meta: allKeys.filter((k) => k.includes('label') || k.includes('slug')),
    other: allKeys.filter(
      (k) => !k.includes('brand') && !k.includes('label') && !k.includes('slug')
    ),
  };

  let html = `<html><head><title>Version Diff</title><style>
      body { font-family: sans-serif; background: #111; color: #fff; padding: 1rem; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #333; padding: 0.5rem; vertical-align: top; }
      th { background: #222; }
      .diff { background: #330000; }
    </style></head><body>`;
  html += '<h2>Side-by-Side Version Comparison</h2>';
  html += '<table><tr><th>Base Version</th><th>Compared Version</th></tr>';

  const renderGroup = (title: string, keys: string[]) => {
    html += `<tr><td colspan=2 style='background:#222;text-align:center;font-weight:bold'><details open><summary>${title}</summary><table>`;
    keys.forEach((key) => {
      const baseVal = base[key];
      const compareVal = compare[key];
      const changed = baseVal !== compareVal;
      html += `<tr>
          <td class="${changed ? 'diff' : ''}"><strong>${key}</strong>: ${JSON.stringify(baseVal)}</td>
          <td class="${changed ? 'diff' : ''}"><strong>${key}</strong>: ${JSON.stringify(compareVal)}</td>
        </tr>`;
    });
    html += `</table></summary></details>`;
  };

  renderGroup('Branding Fields', grouped.branding);
  renderGroup('Meta Fields', grouped.meta);
  renderGroup('Other Fields', grouped.other);

  html += '</table></body></html>';
  return html;
}
