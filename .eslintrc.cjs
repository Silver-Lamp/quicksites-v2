require('@rushstack/eslint-patch/modern-module-resolution');
const path = require('path');

module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    es2021: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  plugins: ['@typescript-eslint', 'prettier', 'markdown', 'import'],
  extends: [
    'next/core-web-vitals',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
  settings: {
    'import/parsers': {
      '@typescript-eslint/parser': ['.ts', '.tsx'],
    },
    'import/resolver': {
      // Reads "baseUrl" + "paths" from tsconfig.json
      typescript: {
        project: path.resolve(__dirname, 'tsconfig.json'),
        alwaysTryTypes: true,
      },
      // Fallback resolution
      node: { extensions: ['.js', '.jsx', '.ts', '.tsx'] },
    },
  },
  ignorePatterns: [
    '**/node_modules/**',
    '**/.next/**',
    '**/dist/**',
    '**/coverage/**',
    '**/.coverage/**',
    '**/public/**',
    '**/out/**',
    '**/build/**',
    '**/__snapshots__/**',
    '**/*.log',
    '**/*.lock',
    '**/*.zip',
    '**/*.png',
    '**/*.jpg',
    '**/*.jpeg',
    '**/*.svg',
    '**/*.snap',
    '**/.turbo/**',
    '**/.test-results/**',
    '**/.storybook-static/**',
    '**/playwright-report/**',
  ],
  rules: {
    'prettier/prettier': 'warn',
    'no-restricted-syntax': [
      'error',
      {
        selector: "AwaitExpression > CallExpression[callee.name='headers']",
        message: "❌ Do not use `await headers()`. This function is synchronous in App Router.",
      },
      {
        selector: "AwaitExpression > CallExpression[callee.name='cookies']",
        message: "❌ Do not use `await cookies()`. This function is synchronous in App Router.",
      },
    ],
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-empty-interface': 'off',
    '@typescript-eslint/no-empty-object-type': 'off',
    'no-restricted-imports': [
      'warn',
      {
        paths: [
          {
            name: '@supabase/supabase-js',
            importNames: ['createClient'],
            message:
              '⚠️ Use the shared client from `lib/supabaseClient.ts` instead of creating a new Supabase client.',
          },
        ],
      },
    ],
  },
  overrides: [
    {
      files: ['**/*.cjs'],
      parserOptions: {
        sourceType: 'script',
      },
      env: {
        node: true,
      },
      globals: {
        module: 'writable',
        require: 'writable',
        __dirname: 'readonly',
        process: 'readonly',
        exports: 'readonly',
      },
    },
    {
      files: ['**/*.mjs'],
      parserOptions: {
        sourceType: 'module',
      },
      globals: {
        import: 'readonly',
        require: 'readonly',
        process: 'readonly',
      },
    },
    {
      files: ['**/*.config.{js,ts}'],
      parserOptions: {
        sourceType: 'script',
      },
      globals: {
        module: 'writable',
        require: 'writable',
        __dirname: 'readonly',
        process: 'readonly',
        exports: 'readonly',
      },
      rules: {
        '@typescript-eslint/no-require-imports': 'off',
      },
    },
    {
      files: [
        'scripts/**/*.{js,ts}',
        'bin/**/*.{js,ts}',
        'packages/*/scripts/**/*.{js,ts}',
      ],
      env: { node: true },
      globals: {
        console: 'readonly',
        process: 'readonly',
        __dirname: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
      },
      rules: {
        '@typescript-eslint/no-require-imports': 'off',
      },
    },
    {
      files: ['tools/cli/**/*.{js,ts}'],
      env: { node: true },
      globals: {
        console: 'readonly',
        process: 'readonly',
      },
      rules: {
        '@typescript-eslint/no-require-imports': 'off',
      },
    },
    {
      files: ['**/*.deno.ts'],
      globals: {
        Deno: 'readonly',
      },
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
    // RSC (pages/layouts) must NOT import the write-enabled client
    {
      files: ['app/**/{page,layout}.@(ts|tsx)'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            paths: [
              {
                name: '@/lib/supabase/serverClient',
                importNames: ['getSupabaseForAction'],
                message:
                  'Do not use getSupabaseForAction in RSC (pages/layouts). Use getSupabaseRSC instead.',
              },
            ],
          },
        ],
      },
    },
    // Server Actions / Route Handlers must NOT import the read-only client
    {
      files: [
        'app/**/route.@(ts|tsx)',
        'app/**/actions.@(ts|tsx)',
        'app/**/server/**/*.@(ts|tsx)',
      ],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            paths: [
              {
                name: '@/lib/supabase/serverClient',
                importNames: ['getSupabaseRSC', 'getServerSupabaseClient'],
                message:
                  'Do not use getSupabaseRSC in actions/routes. Use getSupabaseForAction so cookies can be written.',
              },
            ],
          },
        ],
      },
    },
    {
      files: ['**/*.md'],
      excludedFiles: ['playwright-report/**'],
      processor: 'markdown/markdown',
    },
    {
      files: ['**/*.md/*.ts', '**/*.md/*.tsx'],
      excludedFiles: ['playwright-report/**'],
      rules: {
        '@typescript-eslint/no-unused-expressions': 'off',
      },
    },
    {
      files: ['init.js'],
      parserOptions: {
        sourceType: 'module',
      },
      globals: {
        console: 'readonly',
        process: 'readonly',
      },
    },
    {
      files: ['.lint-tmp/scripts/lint-digest.js'],
      parserOptions: {
        sourceType: 'module',
      },
      globals: {
        console: 'readonly',
        process: 'readonly',
      },
    },
  ],
};
