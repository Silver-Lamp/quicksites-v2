// components/admin/theme-device-preview.tsx

import { useTheme } from '@/hooks/useThemeContext';
import { themeToClassnames } from '@/lib/theme/themeToClassnames';
import clsx from 'clsx';

export function ThemeDevicePreview() {
  const { theme } = useTheme();
  const style = themeToClassnames(theme);

  return (
    <div className="border rounded-lg overflow-hidden shadow-xl bg-white dark:bg-neutral-900 max-w-md mx-auto mt-6">
      <div className="border-b p-2 text-xs text-center bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
        Device Preview
      </div>
      <div className="aspect-[375/667] relative">
        <iframe
          title="Theme Preview"
          src="/preview?theme=active"
          className={clsx('absolute inset-0 w-full h-full', style.radius)}
        />
      </div>
    </div>
  );
}
