import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-plugin-prettier';
import markdown from 'eslint-plugin-markdown';

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
      markdown,
    },
    rules: {
      'prettier/prettier': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-empty-interface': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  },

  // CommonJS Configs (.cjs)
  {
    files: ['**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        module: 'writable',
        require: 'writable',
        __dirname: 'readonly',
        process: 'readonly',
        exports: 'readonly',
      },
    },
  },

  // ESM Configs (.mjs)
  {
    files: ['**/*.mjs'],
    languageOptions: {
      sourceType: 'module',
      globals: {
        import: 'readonly',
        require: 'readonly',
        process: 'readonly',
      },
    },
  },

  // CommonJS Config Files (.config.js / .config.ts)
  {
    files: ['**/*.config.{js,ts}'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        module: 'writable',
        require: 'writable',
        __dirname: 'readonly',
        process: 'readonly',
        exports: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },

  // Scripts in scripts/, bin/, packages/*/scripts
  {
    files: [
      'scripts/**/*.{js,ts}',
      'bin/**/*.{js,ts}',
      'packages/*/scripts/**/*.{js,ts}',
    ],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        console: 'readonly',
        process: 'readonly',
        __dirname: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },

  // CLI tools (tools/cli/)
  {
    files: ['tools/cli/**/*.{js,ts}'],
    languageOptions: {
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },

  // Optional: Deno
  {
    files: ['**/*.deno.ts'],
    languageOptions: {
      globals: {
        Deno: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  // Markdown files (excluding playwright-report)
  {
    files: ['**/*.md'],
    ignores: ['playwright-report/**'],
    processor: markdown.processors.markdown,
  },
  {
    files: ['**/*.md/*.ts', '**/*.md/*.tsx'],
    ignores: ['playwright-report/**'],
    rules: {
      '@typescript-eslint/no-unused-expressions': 'off',
    },
  },

  // init.js root script
  {
    files: ['init.js'],
    languageOptions: {
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
      },
    },
  },

  // ✅ override for lint-digest.js to allow console
  {
    files: ['.lint-tmp/scripts/lint-digest.js'],
    languageOptions: {
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
      },
    },
  },
];
