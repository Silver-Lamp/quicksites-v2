'use client';

import { useTransition } from 'react';
import { randomChefProfile } from '@/app/actions/randomChefProfile';
import { generateChefAvatar } from '@/app/actions/generateChefAvatar';
import { Button } from '@/components/ui/button';
import { Loader } from 'lucide-react';

type Fields = {
  name: string;
  location: string;
  profile_image_url?: string;
  youtube_url: string;
  bio: string;
  certifications_multiline: string;
};

export default function ProfileAutofillToolbar({
  getFields,          // () => current fields
  setFields,          // (f: Partial<Fields>) => void
}: {
  getFields: () => Fields;
  setFields: (f: Partial<Fields>) => void;
}) {
  const [pending, start] = useTransition();

  const onRandomize = () => start(async () => {
    const data = await randomChefProfile();
    setFields(data);
  });

  const onGenerateAvatar = () => start(async () => {
    const { name } = getFields();
    const res = await generateChefAvatar({ seedName: name, style: 'photo', size: '512x512' });
    const url = res.imageUrl ?? res.dataUrl; // prefer uploaded URL, else data URL
    if (url) setFields({ profile_image_url: url });
  });

  return (
    <div className="flex gap-2">
      <Button variant="secondary" onClick={onRandomize} disabled={pending}>
        {pending ? <><Loader className="mr-2 h-4 w-4 animate-spin" />Filling…</> : "Fill Random Info"}
      </Button>
      <Button onClick={onGenerateAvatar} disabled={pending}>
        {pending ? <><Loader className="mr-2 h-4 w-4 animate-spin" />Generating…</> : "Generate Avatar"}
      </Button>
    </div>
  );
}
