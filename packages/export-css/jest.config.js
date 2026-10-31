// packages/export-css/jest.config.js
const shared = {
  preset: 'ts-jest',
  roots: ['<rootDir>/src'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }]
  },
  moduleNameMapper: {
    '^@kazo-ca/timeline-runtime$': '<rootDir>/../runtime/src/index.ts'
  }
};

/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/**/__tests__/**'],
  coverageDirectory: 'coverage',
  projects: [
    {
      ...shared,
      displayName: 'pure-css',
      testEnvironment: 'node',
      testMatch: ['**/__tests__/**/*.test.ts'],
      testPathIgnorePatterns: ['\\.browser\\.test\\.ts$']
    },
    {
      ...shared,
      displayName: 'html-css',
      testEnvironment: 'jsdom',
      testMatch: ['**/__tests__/**/*.browser.test.ts']
    }
  ]
};
