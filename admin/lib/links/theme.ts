export const linkThemeMap = {
  primary: 'text-blue-500 underline',
  muted: 'text-gray-400 underline',
  danger: 'text-red-500 underline',
  outline: 'border border-white text-white px-2 py-0.5 rounded',
} as const;

export type LinkTheme = keyof typeof linkThemeMap;
