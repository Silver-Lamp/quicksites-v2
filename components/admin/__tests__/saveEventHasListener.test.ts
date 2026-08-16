// A save event with no listener cannot fail loudly.
//
// `qs:toolbar:save-now` was dispatched from nine places in the editor — the settings sidebar,
// the e-commerce panel, the product manager, the products-grid editor, the services panel, the
// hero editor, and ⌘S from the hero command palette — and the only listener in the repo was
// identity-panel's, which commits identity fields only and only when that panel is dirty. Every
// other caller's request went nowhere.
//
// Nothing threw and nothing logged. The in-memory template updated, the preview rendered the
// change, and the row was never written — so it presented as "it saved and then forgot", which
// is the hardest possible symptom to attribute. It cost an evening across several panels before
// the missing listener was found.
//
// This test asserts the parity: if you dispatch a global save event, something must listen.

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '../../..');
const DIRS = ['components', 'app', 'lib'].map((d) => path.join(ROOT, d));

/** Events that mean "commit the template now". Dispatching one implies a listener exists. */
const SAVE_EVENTS = ['qs:toolbar:save-now', 'qs:save-now'];

function sourceFiles(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

const FILES = DIRS.flatMap((d) => sourceFiles(d));
const SOURCES = FILES.map((f) => ({ file: f, src: fs.readFileSync(f, 'utf8') }));

describe('global save events have a listener', () => {
  it('scans a non-empty source set', () => {
    // A sweep that matches nothing reports success — pin the corpus so a moved directory
    // turns this red rather than silently vacuous.
    expect(FILES.length).toBeGreaterThan(200);
  });

  for (const ev of SAVE_EVENTS) {
    it(`"${ev}" is both dispatched and listened for`, () => {
      const dispatchers = SOURCES.filter(({ src }) =>
        new RegExp(`dispatchEvent\\([^)]*['"\`]${ev}['"\`]`, 's').test(src) ||
        new RegExp(`fire\\(\\s*['"\`]${ev}['"\`]`).test(src),
      );

      const listeners = SOURCES.filter(({ src }) =>
        // Direct: addEventListener('ev', ...). Indirect: the event named in an array that is
        // then iterated into addEventListener — how identity-panel registers its bundle.
        new RegExp(`addEventListener\\(\\s*['"\`]${ev}['"\`]`).test(src) ||
        (new RegExp(`['"\`]${ev}['"\`]`).test(src) && /addEventListener\(\s*ev\b|forEach\(\(?ev\)?\s*=>/.test(src)),
      );

      // Only meaningful while something still dispatches it.
      if (!dispatchers.length) return;

      expect({
        event: ev,
        dispatchers: dispatchers.length,
        listeners: listeners.map((l) => path.relative(ROOT, l.file)),
      }).toEqual(
        expect.objectContaining({ listeners: expect.arrayContaining([expect.any(String)]) }),
      );
      expect(listeners.length).toBeGreaterThan(0);
    });
  }

  it('the toolbar itself listens — it owns the commit queue', () => {
    // Identity-panel listened too, but it only commits identity columns. The toolbar is the
    // only thing that can write the full template, so it specifically must be a listener.
    const toolbar = SOURCES.find(({ file }) => file.endsWith('TemplateActionToolbar.tsx'));
    expect(toolbar).toBeDefined();
    expect(toolbar!.src).toMatch(/addEventListener\(\s*ev\b|addEventListener\(\s*['"`]qs:toolbar:save-now['"`]/);
    expect(toolbar!.src).toMatch(/qs:toolbar:save-now/);
  });
});
