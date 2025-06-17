import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-plugin-prettier';

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,ts,jsx,tsx}'],
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/coverage/**',
      '**/public/**',
      '**/.venv/**',
      '**/scripts/check-links.js',
      'node_modules/',
      'dist/',
      'coverage/',
      'public/',
      'build/',
      '.next/',
      '.venv/',
      'out/',
      'coverage/',
      'public/',
      '**/*.log',
      '**/*.lock',
      '**/*.zip',
      '**/*.png',
      '**/*.jpg',
      '**/*.jpeg',
      '**/*.svg',
      '**/__snapshots__/**',
      '**/.snapshots/**',
      '.venv/**',
      '**/.venv/**',
    ],
    languageOptions: {
      globals: {
        process: 'readonly',
        __dirname: 'readonly',
        module: 'readonly',
        require: 'readonly',
      },
    },
    plugins: {
      prettier,
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      'prettier/prettier': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-empty-interface': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  },
];
