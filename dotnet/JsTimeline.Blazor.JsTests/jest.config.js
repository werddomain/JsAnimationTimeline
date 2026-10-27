// dotnet/JsTimeline.Blazor.JsTests/jest.config.js
/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  // The wwwroot modules are plain ES modules: ts-jest compiles them to CommonJS like the tests.
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: 'tsconfig.json' }]
  },
  transformIgnorePatterns: ['/node_modules/'],
  moduleNameMapper: {
    '\\.less$': '<rootDir>/../../packages/editor/src/legacy/__tests__/__mocks__/styleMock.js',
    // The tests run before any build: the runtime copied into wwwroot/js is read from its sources,
    // as one module shared with the editor.
    '^\\.\\./js/timeline-runtime\\.mjs$': '<rootDir>/../../packages/runtime/src/index.ts',
    '^\\.\\./js/timeline-editor\\.mjs$': '<rootDir>/../../packages/editor/src/index.ts',
    '^@werddomain/timeline-runtime$': '<rootDir>/../../packages/runtime/src/index.ts',
    '^@werddomain/timeline-editor$': '<rootDir>/../../packages/editor/src/index.ts'
  }
};
