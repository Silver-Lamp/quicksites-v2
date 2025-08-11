import { FC } from 'react';
import Image from 'next/image';
import ThemeScope from '@/components/ui/theme-scope';

type Meal = { name: string; price: string; availability: string; image_url: string };
type ChefProfileContent = {
  name: string;
  location: string;
  profile_image_url: string;
  kitchen_video_url?: string;
  bio: string;
  certifications: string[];
  meals: Meal[];
};

const ChefProfileBlock: FC<{
  content: ChefProfileContent;
  colorMode?: 'light' | 'dark';
  className?: string;
}> = ({ content, colorMode = 'light', className = '' }) => {
  return (
    <ThemeScope
      mode={colorMode}
      className={`bg-white data-[theme=dark]:bg-neutral-950 text-neutral-900 data-[theme=dark]:text-neutral-100 p-6 rounded-2xl ${className}`}
    >
      <div className="max-w-4xl mx-auto rounded-2xl shadow-sm ring-1 ring-neutral-200 data-[theme=dark]:ring-neutral-800 p-6">
        <div className="flex gap-6">
          <Image
            src={content.profile_image_url}
            alt={content.name}
            width={120}
            height={120}
            className="rounded-full object-cover ring-1 ring-neutral-200 data-[theme=dark]:ring-neutral-800"
          />
          <div>
            <h2 className="text-2xl font-bold">{content.name}</h2>
            <p className="text-neutral-500 data-[theme=dark]:text-neutral-400">{content.location}</p>
            <p className="mt-2 text-neutral-800 data-[theme=dark]:text-neutral-200">{content.bio}</p>
            <ul className="mt-2 text-sm list-disc ml-4 text-emerald-700 data-[theme=dark]:text-emerald-400">
              {content.certifications.map((cert) => <li key={cert}>{cert}</li>)}
            </ul>
          </div>
        </div>

        {content.kitchen_video_url && (
          <div className="mt-4">
            <video
              src={content.kitchen_video_url}
              controls
              className="w-full rounded-xl ring-1 ring-neutral-200 data-[theme=dark]:ring-neutral-800"
            />
          </div>
        )}

        <div className="mt-6">
          <h3 className="text-xl font-semibold mb-2">Upcoming Meals</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {content.meals.map((meal) => (
              <div
                key={meal.name}
                className="rounded-xl overflow-hidden ring-1 ring-neutral-200 data-[theme=dark]:ring-neutral-800 bg-white data-[theme=dark]:bg-neutral-900"
              >
                <Image
                  src={meal.image_url}
                  alt={meal.name}
                  width={600}
                  height={400}
                  className="w-full h-40 object-cover"
                />
                <div className="p-3">
                  <p className="font-medium">{meal.name}</p>
                  <p className="text-sm text-neutral-500 data-[theme=dark]:text-neutral-400">
                    {meal.availability}
                  </p>
                  <p className="font-semibold text-emerald-700 data-[theme=dark]:text-emerald-400">
                    {meal.price}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ThemeScope>
  );
};

export default ChefProfileBlock;
