// Shown while the template editor's server component loads the site from the DB.
// Plays the QuickSites neon-steampunk loader video (the "dude") instead of a blank
// flash. list/new/gsc-bulk-stats are separate route segments, so this only covers
// the editor (and the bare /admin/templates index).
import BrandLoader from '@/components/brand/BrandLoader';

export default function TemplateEditorLoading() {
  return <BrandLoader open message="Opening your site" />;
}
