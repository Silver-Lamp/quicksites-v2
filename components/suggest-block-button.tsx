import { generateHeroBlock } from '@/lib/generateHero';
import { generateServices } from '@/lib/generateServices';

export function SuggestBlockButton({
  type,
  onSuggest,
}: {
  type: 'hero' | 'services';
  onSuggest: (data: any) => void;
}) {
  const handleClick = () => {
    if (type === 'hero') {
      const suggestion = generateHeroBlock('Your Business', 'clean');
      onSuggest(suggestion);
    } else {
      const suggestion = generateServices('template-clean');
      onSuggest(suggestion);
    }
  };

  return (
    <button className="text-xs text-blue-400 underline" onClick={handleClick}>
      Suggest {type === 'hero' ? 'Hero Text' : 'Services'}
    </button>
  );
}
