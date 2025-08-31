// components/admin/templates/render-blocks/chef-profile.view.tsx
import { FC, ReactNode } from 'react';
import Image from 'next/image';
import ThemeScope from '@/components/ui/theme-scope';

export type Meal = {
  id?: string;
  name: string;
  price: string;
  availability: string;
  image_url: string;
};

export type ChefProfileContent = {
  name: string;
  location: string;
  profile_image_url: string;
  kitchen_video_url?: string;
  bio: string;
  certifications: string[];
  meals: Meal[];
  merchant_id: string;
};

export type ChefProfileViewProps = {
  content: ChefProfileContent;
  colorMode?: 'light' | 'dark';
  className?: string;
  /** Pass a client-only badge element from the wrapper (optional). */
  couponBadge?: ReactNode;
};

// Stable key helper for meals without ids
function mealKey(meal: Meal, idx: number) {
  if (meal.id) return meal.id;
  const safe = (v?: string) => (v ?? '').trim().toLowerCase();
  const base = `${safe(meal.name)}|${safe(meal.price)}|${safe(meal.availability)}|${safe(meal.image_url)}`;
  return `meal:${base}:${idx}`;
}

const ChefProfileView: FC<ChefProfileViewProps> = ({
  content,
  colorMode = 'light',
  className = '',
  couponBadge,
}) => {
  const {
    name,
    location,
    profile_image_url,
    kitchen_video_url,
    bio,
    certifications = [],
    meals = [],
  } = content;

  return (
    <ThemeScope
      mode={colorMode}
      className={`bg-white data-[theme=dark]:bg-neutral-950 text-neutral-900 data-[theme=dark]:text-neutral-100 p-6 rounded-2xl ${className}`}
    >
      <div className="max-w-4xl mx-auto rounded-2xl shadow-sm ring-1 ring-neutral-200 data-[theme=dark]:ring-neutral-800 p-6">
        <div className="flex gap-6">
          <Image
            src={profile_image_url}
            alt={name || 'Chef profile image'}
            width={120}
            height={120}
            className="rounded-full object-cover ring-1 ring-neutral-200 data-[theme=dark]:ring-neutral-800"
          />
          <div className="min-w-0">
            <h2 className="text-2xl font-bold truncate">{name}</h2>
            {location && (
              <p className="text-neutral-500 data-[theme=dark]:text-neutral-400">{location}</p>
            )}
            {bio && (
              <p className="mt-2 text-neutral-800 data-[theme=dark]:text-neutral-200">{bio}</p>
            )}
            {!!certifications.length && (
              <ul className="mt-2 text-sm list-disc ml-4 text-emerald-700 data-[theme=dark]:text-emerald-400">
                {certifications.map((cert, i) => (
                  <li key={`${cert}-${i}`}>{cert}</li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {kitchen_video_url && (
          <div className="mt-4">
            <video
              src={kitchen_video_url}
              controls
              className="w-full rounded-xl ring-1 ring-neutral-200 data-[theme=dark]:ring-neutral-800"
            />
          </div>
        )}

        {couponBadge}

        <div className="mt-6">
          <h3 className="text-xl font-semibold mb-2">Upcoming Meals</h3>
          {meals.length ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {meals.map((meal, idx) => (
                <div
                  key={mealKey(meal, idx)}
                  className="rounded-xl overflow-hidden ring-1 ring-neutral-200 data-[theme=dark]:ring-neutral-800 bg-white data-[theme=dark]:bg-neutral-900"
                >
                  <Image
                    src={meal.image_url}
                    alt={meal.name || 'Meal image'}
                    width={600}
                    height={400}
                    className="w-full h-40 object-cover"
                  />
                  <div className="p-3">
                    <p className="font-medium truncate">{meal.name}</p>
                    {meal.availability && (
                      <p className="text-sm text-neutral-500 data-[theme=dark]:text-neutral-400">
                        {meal.availability}
                      </p>
                    )}
                    <p className="font-semibold text-emerald-700 data-[theme=dark]:text-emerald-400">
                      {meal.price}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No upcoming meals listed.</p>
          )}
        </div>
      </div>
    </ThemeScope>
  );
};

export default ChefProfileView;
