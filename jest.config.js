module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: './tsconfig.test.json',
    }]
  },
  moduleNameMapper: {
    // CSS 등 비JS 모듈 무시
    '\\.(css|less|scss)$': '<rootDir>/src/__tests__/__mocks__/fileMock.js',
  },
}
