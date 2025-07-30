export default function TermsContent() {
    return (
      <>
        <section id="terms">
        <h2 className="text-2xl font-semibold mb-4">Terms of Service</h2>
        <p className="mb-4">By using QuickSites, you agree to the following terms:</p>

        <h3 className="text-lg font-semibold mt-6">1. Description</h3>
        <p className="mb-4">QuickSites allows users to create and manage websites using prebuilt templates and optional integrations such as Google Search Console.</p>

        <h3 className="text-lg font-semibold mt-6">2. User Responsibilities</h3>
        <ul className="list-disc list-inside space-y-1 mb-4">   
          <li>Keep login credentials secure</li>
          <li>Use the service lawfully</li>
          <li>Do not abuse or reverse-engineer the platform</li>
        </ul>

        <h3 className="text-lg font-semibold mt-6">3. Ownership</h3>
        <p className="mb-4">You retain ownership of your site content. QuickSites retains ownership of the platform, templates, and infrastructure.</p>

        <h3 className="text-lg font-semibold mt-6">4. Limitations</h3>
        <p className="mb-4">We provide the service "as is" and are not liable for outages, SEO performance, or third-party platform changes.</p>

        <h3 className="text-lg font-semibold mt-6">5. Contact</h3>
        <p>For questions about these terms, email <a href="mailto:support@quicksites.ai" className="text-blue-500 underline">support@quicksites.ai</a>.</p>
      </section>
      </>
    );
  }
  