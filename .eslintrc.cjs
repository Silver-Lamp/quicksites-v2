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
    // NOTE: the former no-restricted-syntax rule forbidding `await headers()` /
    // `await cookies()` was removed — it was written for Next 14 (where those were
    // sync). In Next 15 (this repo is on 15.2.6) `headers()`/`cookies()` are ASYNC
    // and MUST be awaited, so the rule flagged correct code as an error (81 false
    // positives) and pushed devs to write broken code. See the Next 15 async
    // request APIs: https://nextjs.org/docs/app/building-your-application/upgrading/version-15
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-empty-interface': 'off',
    '@typescript-eslint/no-empty-object-type': 'off',

    // --- Ratchet (2026-06-30) ---------------------------------------------
    // These rules have a backlog of pre-existing violations. To make the CI
    // Lint step a BLOCKING gate now (so it catches NEW errors), the existing
    // debt is baselined to 'warn' — still surfaced, just non-fatal. Burn each
    // down and flip back to 'error' over time. Counts at time of ratchet:
    'react-hooks/rules-of-hooks': 'warn',                          // 113 — real: async components calling hooks, conditional hooks
    '@typescript-eslint/ban-ts-comment': 'warn',                   // 37 — prefer @ts-expect-error over @ts-ignore
    'react/no-unescaped-entities': 'warn',                         // 15
    '@typescript-eslint/no-unused-expressions': 'warn',            // 5
    'prefer-const': 'warn',                                        // 2 mixed-destructure edge cases (33 others fixed in this PR)
    '@next/next/no-html-link-for-pages': 'warn',                   // 2
    'react/display-name': 'warn',                                  // 2
    '@typescript-eslint/no-namespace': 'warn',                     // 1 — `declare module` augmentation
    '@typescript-eslint/no-require-imports': 'warn',               // 1 — intentional optional require in try/catch
    '@typescript-eslint/no-non-null-asserted-optional-chain': 'warn', // 1
    // ----------------------------------------------------------------------
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
