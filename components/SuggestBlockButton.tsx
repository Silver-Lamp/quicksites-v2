import { generateHero } from '../lib/generateHero.js';
import { generateServices } from '../lib/generateServices.js';

export function SuggestBlockButton({
  type,
  onSuggest,
}: {
  type: 'hero' | 'services';
  onSuggest: (data: any) => void;
}) {
  const handleClick = () => {
    if (type === 'hero') {
      const suggestion = generateHero('Your Business', 'clean');
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
