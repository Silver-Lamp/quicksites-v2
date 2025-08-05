// ✅ meal-card.tsx
import { FC } from 'react';
import Image from 'next/image';

const MealCardBlock: FC<{
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
}> = ({ content }) => {
  return (
    <div className="border rounded-2xl overflow-hidden shadow-md max-w-xl mx-auto bg-white">
      <Image
        src={content.image_url}
        alt={content.title}
        width={800}
        height={500}
        className="w-full h-64 object-cover"
      />
      <div className="p-4">
        <h3 className="text-xl font-bold">{content.title}</h3>
        <p className="text-sm text-gray-600 mb-1">by {content.chef_name}</p>
        <p className="text-gray-800 mb-2">{content.description}</p>
        <p className="text-sm text-gray-500 mb-1">
          <strong>Available:</strong> {content.availability}
        </p>
        <p className="font-semibold text-green-700">{content.price}</p>
        {content.tags && (
          <div className="mt-2 flex flex-wrap gap-1 text-xs text-gray-500">
            {content.tags.map((tag) => (
              <span key={tag} className="bg-gray-100 px-2 py-1 rounded-full">
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
              className="w-full rounded-md"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default MealCardBlock;
