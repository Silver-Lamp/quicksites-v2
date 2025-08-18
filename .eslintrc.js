// .eslintrc.js
/* eslint-env node */
const path = require('path');

/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  // You can keep/merge whatever you already extend.
  extends: ['next/core-web-vitals'],
  plugins: ['import'],

  // 👇 let eslint-plugin-import understand TS paths (so "@/..." resolves)
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

  // ✅ keep your custom inline rule
  rules: {
    'no-multi-supabase-clients': {
      create(context) {
        return {
          ImportDeclaration(node) {
            if (
              node.source.value === '@supabase/supabase-js' &&
              node.specifiers?.some((s) => s.imported?.name === 'createClient')
            ) {
              context.report({
                node,
                message:
                  'Avoid creating multiple Supabase clients. Use the shared client from lib/supabaseClient.',
              });
            }
          },
        };
      },
    },
  },

  // ✅ guardrails for Supabase helper usage
  overrides: [
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
  ],
};
