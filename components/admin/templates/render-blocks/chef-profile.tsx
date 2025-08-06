import { FC } from 'react';
import Image from 'next/image';

const ChefProfileBlock: FC<{
  content: {
    name: string;
    location: string;
    profile_image_url: string;
    kitchen_video_url?: string;
    bio: string;
    certifications: string[];
    meals: {
      name: string;
      price: string;
      availability: string;
      image_url: string;
    }[];
  };
}> = ({ content }) => {
  return (
    <div className="max-w-4xl mx-auto rounded-2xl shadow p-6 bg-white">
      <div className="flex gap-6">
        <Image
          src={content.profile_image_url}
          alt={content.name}
          width={120}
          height={120}
          className="rounded-full object-cover"
        />
        <div>
          <h2 className="text-2xl font-bold">{content.name}</h2>
          <p className="text-gray-500">{content.location}</p>
          <p className="mt-2 text-gray-800">{content.bio}</p>
          <ul className="mt-2 text-sm text-green-700 list-disc ml-4">
            {content.certifications.map((cert) => (
              <li key={cert}>{cert}</li>
            ))}
          </ul>
        </div>
      </div>

      {content.kitchen_video_url && (
        <div className="mt-4">
          <video
            src={content.kitchen_video_url}
            controls
            className="w-full rounded-xl"
          />
        </div>
      )}

      <div className="mt-6">
        <h3 className="text-xl font-semibold mb-2">Upcoming Meals</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {content.meals.map((meal) => (
            <div
              key={meal.name}
              className="border rounded-lg overflow-hidden shadow-sm"
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
                <p className="text-sm text-gray-500">{meal.availability}</p>
                <p className="text-green-700 font-semibold">{meal.price}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ChefProfileBlock;
