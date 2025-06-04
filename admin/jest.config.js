module.exports = {
    testEnvironment: 'jsdom',
    testMatch: ['<rootDir>/__tests__/**/*.test.ts?(x)'],
    setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
    transform: {
      '^.+\\.(ts|tsx)$': ['babel-jest', { presets: ['next/babel'] }]
    },
    moduleNameMapper: {
      '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
      '^@/(.*)$': '<rootDir>/$1'
    }
  };
  