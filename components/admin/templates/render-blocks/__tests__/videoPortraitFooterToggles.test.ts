/**
 * @jest-environment node
 */
// Two owner asks from the B Hard build (2026-10-16): a portrait commercial needs a phone-width
// player with a poster (not a 1,300 px black rectangle), and a site with no "where" needs to
// switch the footer's map / "Find Us" column off. Source guards, because both are render facts
// a type check cannot see.
import fs from 'node:fs';
import path from 'node:path';
import { stripComments } from '@/test/stripComments';
import { blockContentSchemaMap } from '@/admin/lib/zod/blockSchema';
import { DEFAULT_BLOCK_CONTENT as defaultBlockContent } from '@/lib/blocks/defaultBlockContent';

const read = (p: string) => stripComments(fs.readFileSync(path.join(process.cwd(), p), 'utf8'));

describe('video block — portrait + poster', () => {
  const src = read('components/admin/templates/render-blocks/video.tsx');
  it('still renders nothing in public when there is no url', () => {
    expect(src).toMatch(/if \(!url\) \{\s*return isEditorContext\(previewOnly\)/);
  });
  it('portrait is phone-width and centred; the poster is the first frame; plays inline', () => {
    expect(src).toMatch(/max-w-\[360px\]/);
    expect(src).toMatch(/aspect-\[9\/16\]/);
    expect(src).toMatch(/poster=\{poster\}/);
    expect(src).toMatch(/playsInline/);
    expect(src).toMatch(/preload=\{poster \? 'none' : 'metadata'\}/);
  });
  it('schema + default carry the new fields and a bare url still validates', () => {
    const schema = (blockContentSchemaMap as any).video.schema;
    expect(schema.safeParse({ url: 'https://x.test/v.mp4' }).success).toBe(true);
    expect(schema.safeParse({ url: 'https://x.test/v.mp4', poster: 'https://x.test/p.jpg', orientation: 'portrait', title: 'Ad' }).success).toBe(true);
    expect(schema.safeParse({ url: 'https://x.test/v.mp4', orientation: 'sideways' }).success).toBe(false);
    expect((defaultBlockContent as any).video.orientation).toBe('landscape');
  });
  it('the editor exposes poster and orientation', () => {
    const ed = read('components/admin/templates/block-editors/video-editor.tsx');
    expect(ed).toMatch(/poster/);
    expect(ed).toMatch(/orientation/);
    expect(ed).toMatch(/value="portrait"/);
  });
});

describe('footer — "Find Us" column and map toggles', () => {
  const src = read('components/admin/templates/render-blocks/footer.tsx');
  it('absent means shown; false hides', () => {
    expect(src).toMatch(/const showFindUs = final\?\.show_find_us !== false/);
    expect(src).toMatch(/const showMap = showFindUs && final\?\.show_map !== false/);
    expect(src).toMatch(/const centerOk = showMap && isValidLatLng\(coords\)/);
    expect(src).toMatch(/!showFindUs \|\| \(!centerOk && !socials\.length && !showEditorHints\)/);
    expect(src).toMatch(/isPersonal \|\| !showMap \? 'hidden'/);
  });
  it('a map switched off is not geocoded either', () => {
    expect(src).toMatch(/useGeocode\(hasCoords \? null : showMap \? fullAddressForGeocode : null\)/);
  });
  it('the editor has both checkboxes and the schema names both keys', () => {
    const ed = read('components/admin/templates/block-editors/footer-editor.tsx');
    expect(ed).toMatch(/update\('show_find_us', e\.target\.checked\)/);
    expect(ed).toMatch(/update\('show_map', e\.target\.checked\)/);
    const schema = (blockContentSchemaMap as any).footer.schema;
    const parsed = schema.safeParse({ links: [], show_map: false, show_find_us: true });
    expect(parsed.success).toBe(true);
    expect(parsed.data.show_map).toBe(false);
  });
});
