module.exports = {
  preset: 'jest-expo',
  modulePathIgnorePatterns: ["<rootDir>/.expo/"],
  transformIgnorePatterns: [
    "node_modules/(?!(jest-)?react-native|@react-native|expo(nent)?|@expo(nent)?/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|@react-navigation/.*|expo-modules-core|immer|zustand/.*|firebase|@firebase|uuid|gaxios|gcp-metadata|google-auth-library)"
  ],
  setupFiles: ["./jestSetup.js"],
  setupFilesAfterEnv: ["@testing-library/jest-native/extend-expect"],
  moduleNameMapper: {
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$': '<rootDir>/__mocks__/fileMock.js'
  },
  testPathIgnorePatterns: [
    "/node_modules/",
    "/functions/",
    "/scripts/",
    "/.expo/"
  ],
  collectCoverage: true,
  collectCoverageFrom: [
    "src/**/*.{js,jsx,ts,tsx}",
    "!src/**/*.d.ts",
    "!src/styles/**/*",
    "!src/models/**/*",
    "!src/config/**/*",
    "!src/**/index.{js,ts,tsx}"
  ],
  coveragePathIgnorePatterns: [
    "/node_modules/",
    "/__tests__/",
    "/__mocks__/"
  ],
  coverageReporters: ["text", "lcov", "html"],
  coverageThreshold: {
    global: { statements: 88, branches: 80, functions: 88, lines: 92 },
  },
};
