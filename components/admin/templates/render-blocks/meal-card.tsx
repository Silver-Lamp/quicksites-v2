// components/admin/templates/render-blocks/meal-card.tsx
import { FC } from 'react';
import Image from 'next/image';
import clsx from 'clsx';

type Props = {
  content: {
    title: string;
    chef_name: string;
    price: string;
    image_url: string;
    description: string;
    availability: string;
    tags?: string[];
    video_url?: string;
  };
  /** Optional if you ever want to drive styles by prop in addition to global `.dark` */
  colorMode?: 'light' | 'dark';
  className?: string;
};

const MealCardBlock: FC<Props> = ({ content, className }) => {
  const hasImage = !!content.image_url;

  return (
    <article
      className={clsx(
        'max-w-xl mx-auto overflow-hidden rounded-2xl border shadow-md transition-colors',
        'bg-white text-zinc-900 border-zinc-200',
        'dark:bg-neutral-900 dark:text-neutral-100 dark:border-neutral-700',
        className,
      )}
    >
      {hasImage ? (
        <div className="relative">
          <Image
            src={content.image_url}
            alt={content.title || 'Meal image'}
            width={800}
            height={450}
            sizes="(max-width: 768px) 100vw, 800px"
            className="h-64 w-full object-cover"
            priority={false}
          />
        </div>
      ) : (
        <div className="h-64 w-full bg-zinc-100 dark:bg-neutral-800" />
      )}

      <div className="p-5">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">by {content.chef_name}</p>
        <h3 className="mt-1 text-xl font-semibold leading-snug">{content.title}</h3>

        {content.description && (
          <p className="mt-1 text-zinc-700 dark:text-zinc-300">{content.description}</p>
        )}

        <div className="mt-3 flex items-baseline justify-between gap-3">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            <span className="font-medium text-zinc-700 dark:text-zinc-200">Available:</span>{' '}
            {content.availability}
          </p>
          <p className="font-semibold text-emerald-700 dark:text-emerald-400">
            {content.price}
          </p>
        </div>

        {!!content.tags?.length && (
          <div className="mt-3 flex flex-wrap gap-2">
            {content.tags.map((tag) => (
              <span
                key={tag}
                className={clsx(
                  'inline-flex items-center rounded-full border px-2 py-0.5 text-xs',
                  'bg-zinc-100 text-zinc-600 border-zinc-200',
                  'dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-700',
                )}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {content.video_url && (
          <div className="mt-4">
            <video
              src={content.video_url}
              controls
              className="w-full rounded-lg border border-zinc-200 bg-black dark:border-neutral-700"
            />
          </div>
        )}
      </div>
    </article>
  );
};

export default MealCardBlock;
