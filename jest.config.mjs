// jest.config.mjs
export default {
  testEnvironment: 'jsdom',
  testMatch: ['**/__tests__/**/*.test.ts?(x)'],
  // The admin/__tests__ suite was written for Vitest against the admin/ sub-package's
  // OWN node_modules (its own React + RTL), so its component/hook tests don't resolve
  // under root Jest. Quarantine just those; parseTypedQueryValue (pure logic, no React)
  // was converted to Jest and runs. Reviving the React tests needs the admin module
  // resolution sorted out — tracked.
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/admin/__tests__/Template',       // Template*.test.tsx — Vitest + heavy component render
    '<rootDir>/admin/__tests__/useCurrentUser',  // hook test entangled with admin/node_modules React
  ],
  setupFilesAfterEnv: ['<rootDir>/test/jest.setup.ts'],
  transform: {
    '^.+\\.(ts|tsx)$': ['babel-jest', { presets: ['next/babel'] }],
  },
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    // cheerio 1.x resolves to its ESM/browser build under the jsdom env, which Jest
    // won't transform (node_modules is ignored). Pin its CommonJS entry for tests.
    '^cheerio$': '<rootDir>/node_modules/cheerio/dist/commonjs/index.js',
    '^@/(.*)$': '<rootDir>/$1',
  },
};
