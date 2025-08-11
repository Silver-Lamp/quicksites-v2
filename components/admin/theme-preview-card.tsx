// components/admin/theme-preview-card.tsx
import { useEffect } from 'react';
import { useTheme, SiteTheme } from '@/hooks/useThemeContext';
import { Template } from '@/types/template';
import { themeToClassnames } from '@/lib/theme/themeToClassnames';
import clsx from 'clsx';

export function ThemePreviewCard({
  theme,
  colorMode,                 // <- saved template color mode: 'light' | 'dark'
  onToggleColorMode,         // <- parent persists template.color_mode
  onSelectFont,
}: {
  theme: Template['theme'] | string;
  colorMode: 'light' | 'dark';
  onToggleColorMode: () => void | Promise<void>;
  onSelectFont: (font: string) => void;
}) {
  const { theme: ctxTheme, setTheme } = useTheme();

  // Keep the theme context in sync with the saved template color mode
  useEffect(() => {
    if (!ctxTheme) return;
    if (colorMode && ctxTheme.darkMode !== colorMode) {
      setTheme({ ...ctxTheme, darkMode: colorMode });
    }
  }, [colorMode, ctxTheme, setTheme]);

  const styles = themeToClassnames(theme as unknown as SiteTheme);
  const glow = (theme as unknown as SiteTheme)?.glow?.[0];

  const glowBg = glow
    ? `bg-gradient-to-br ${glow.colors.join(' ')} opacity-[${glow.intensity}]`
    : '';

  const isDark = (ctxTheme?.darkMode ?? 'light') === 'dark';

  const handleToggle = async () => {
    // optimistic update for instant visual feedback
    const nextMode = isDark ? 'light' : 'dark';
    setTheme({ ...(ctxTheme || ({} as SiteTheme)), darkMode: nextMode });
    await onToggleColorMode?.();
  };

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

      <button onClick={handleToggle} className="text-sm text-blue-500 underline">
        Toggle to {isDark ? 'light' : 'dark'} mode
      </button>
    </div>
  );
}
