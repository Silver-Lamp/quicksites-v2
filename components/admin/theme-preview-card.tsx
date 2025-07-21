// components/admin/theme-preview-card.tsx

import { useTheme, SiteTheme } from '@/hooks/useThemeContext';
import { Template } from '@/types/template';
import { themeToClassnames } from '@/lib/theme/themeToClassnames';
import clsx from 'clsx';

export function ThemePreviewCard({ theme, onSelectFont }: { theme: Template['theme'] | string, onSelectFont: (font: string) => void }) {
  const { toggleDark } = useTheme();
  const styles = themeToClassnames(theme as unknown as SiteTheme);
  const glow = (theme as unknown as SiteTheme).glow?.[0];

  const glowBg = glow
    ? `bg-gradient-to-br ${glow.colors.join(' ')} opacity-[${glow.intensity}]`
    : '';

  return (
    <div className={clsx('p-6 border shadow-lg space-y-4', styles.radius, styles.font)}>
      <h2 className="text-lg font-semibold">Live Theme Preview</h2>

      <button className={styles.button}>Themed Primary Button</button>
      <button className={styles.outlineButton}>Outlined Button</button>

      <div className="h-24 w-full rounded overflow-hidden relative border">
        <div className={clsx('absolute inset-0', glowBg)} />
        <div className="relative z-10 flex items-center justify-center h-full text-white font-bold">
          Glow Layer
        </div>
      </div>

      <button onClick={toggleDark} className="text-sm text-blue-500 underline">
        Toggle to {theme === 'dark' ? 'light' : 'dark'} mode
      </button>
    </div>
  );
}
