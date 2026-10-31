// packages/runtime/jest.config.js
const shared = {
  preset: 'ts-jest',
  roots: ['<rootDir>/src'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }]
  }
};

/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/**/__tests__/**'],
  coverageDirectory: 'coverage',
  projects: [
    {
      ...shared,
      displayName: 'browser',
      testEnvironment: 'jsdom',
      testMatch: ['**/__tests__/**/*.test.ts'],
      testPathIgnorePatterns: ['<rootDir>/src/playback/__tests__/']
    },
    {
      ...shared,
      displayName: 'generic-playback',
      testEnvironment: 'node',
      testMatch: ['**/playback/__tests__/**/*.test.ts']
    }
  ]
};
