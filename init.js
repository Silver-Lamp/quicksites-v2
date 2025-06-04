// quicksites-core/init.js

import { generateSite } from "./cli/generate-site.js";
import { logDomainGeneration } from "./lib/domainTracker.js";
import { config } from "dotenv";

config(); // Load .env variables

const args = process.argv.slice(2);

const options = {
  city: args[0] || "Mill Creek",
  state: args[1] || "WA",
  template: args[2] || "template1",
};

(async () => {
  try {
    console.log("Generating site for", options);
    const result = await generateSite(options);

    await logDomainGeneration({
      domain: result.domain,
      city: options.city,
      state: options.state,
      template: options.template
    });

    console.log("✅ Site generation complete & logged to Supabase.");
  } catch (err) {
    console.error("❌ Site generation failed:", err);
  }
})();
