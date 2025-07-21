export function getSchemaForBusiness({
  name,
  url,
  phone,
  address,
  description,
  type = 'LocalBusiness',
}: {
  name: string;
  url: string;
  phone: string;
  address: string;
  description: string;
  type?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': type,
    name,
    url,
    telephone: phone,
    address: {
      '@type': 'PostalAddress',
      streetAddress: address,
    },
    description,
  };
}
