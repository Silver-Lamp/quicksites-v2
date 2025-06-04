// cli/generate-site.js

import path from 'path';
import fs from 'fs-extra';

export async function generateSite({ city, state, template }) {
  const domainSlug = `${city.replace(/\s+/g, '').toLowerCase()}towing.com`;
  const outputDir = path.resolve(`outputs/${domainSlug}`);

  await fs.ensureDir(outputDir);

  const templatePath = path.resolve(`templates/${template}`);
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template not found: ${template}`);
  }

  await fs.copy(templatePath, outputDir);

  console.log(`🚚 Generated site for ${city}, ${state} at ${outputDir}`);
  return { domain: domainSlug, path: outputDir };
}
