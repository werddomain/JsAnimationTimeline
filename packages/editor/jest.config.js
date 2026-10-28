/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/styles/**'
  ],
  coverageDirectory: 'coverage',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.test.json'
    }]
  },
  moduleNameMapper: {
    '\\.less$': '<rootDir>/src/__tests__/styleMock.js',
    // Les tests s'exécutent avant tout build : le runtime est lu depuis ses sources.
    '^@werddomain/timeline-runtime$': '<rootDir>/../runtime/src/index.ts'
  }
};
