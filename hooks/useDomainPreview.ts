import Image from 'next/image';
import { useEffect, useState } from 'react';

export function useDomainPreview(domain: string) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const img = new Image();
    const path = `/screenshots/${domain}.png`;
    img.src = path;
    img.onload = () => {
      setImageUrl(path);
      setLoading(false);
    };
    img.onerror = () => {
      setImageUrl(null);
      setLoading(false);
    };
  }, [domain]);

  return { imageUrl, loading };
}
