export default {
  root: true,
  parser: '@typescript-eslint/parser',
  extends: [
    'next/core-web-vitals',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended'
  ],
  plugins: ['@typescript-eslint', 'prettier', 'react'],
  rules: {
    'prettier/prettier': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],

    // 🚫 Prevent <Link><a> misuse
    'react/jsx-no-target-blank': 'error',
    'next/link-passhref': 'error',
    'next/next-link-passhref': 'error'
  }
};
