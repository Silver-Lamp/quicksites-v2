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
    // Git worktrees live INSIDE the repo (.claude/worktrees/<name>), so jest discovers their
    // test files too — doubling every suite and, worse, running a STALE copy of a test against
    // the CURRENT source (the `@/` alias resolves to this root, not the worktree's). That
    // produces failures that look real and cannot be reproduced by editing the file jest names.
    '<rootDir>/.claude/',
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
    // ⚠️ `server-only` is a guard package that exists to BREAK a client bundle importing a server
    // module. Under Jest it simply fails to resolve, which silently made every module carrying it
    // untestable — including lib/serviceJobs, which shipped with zero tests on a surface that
    // records people in their own driveway. Mapping it to a no-op restores the ability to unit test
    // server logic and does not weaken the guard, because the guard only ever fires in a real
    // client build.
    '^server-only$': '<rootDir>/test/stubs/server-only.js',
    '^@/(.*)$': '<rootDir>/$1',
  },
};
