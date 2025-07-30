export default function PrivacyContent() {
    return (
      <>
        <section id="privacy" className="mb-16">
        <h2 className="text-2xl font-semibold mb-4">Privacy Policy</h2>
        <p className="mb-4">QuickSites (“we”, “our”, or “us”) values your privacy. This Privacy Policy explains how we collect, use, and protect your information when you use our website and services, including Google Search Console integrations.</p>

        <h3 className="text-lg font-semibold mt-6">1. Information We Collect</h3>
        <ul className="list-disc list-inside space-y-1 mb-4">
          <li>Personal information (e.g. email address via Google login)</li>
          <li>Site and domain data for website management</li>
          <li>GSC OAuth tokens (limited scope and temporary)</li>
        </ul>

        <h3 className="text-lg font-semibold mt-6">2. How We Use Your Information</h3>
        <ul className="list-disc list-inside space-y-1 mb-4">
          <li>To provide and improve the QuickSites platform</li>
          <li>To enable integrations and analytics features</li>
          <li>To secure your account and troubleshoot issues</li>
        </ul>

        <h3 className="text-lg font-semibold mt-6">3. Google API Usage</h3>
        <p className="mb-4">
          Our use of Google APIs follows the{' '}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            className="text-blue-500 underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google API Services User Data Policy
          </a>
          , including Limited Use requirements.
        </p>

        <h3 className="text-lg font-semibold mt-6">4. Contact</h3>
        <p>If you have questions about this policy, email <a href="mailto:support@quicksites.ai" className="text-blue-500 underline">support@quicksites.ai</a>.</p>
      </section>      </>
    );
  }
  