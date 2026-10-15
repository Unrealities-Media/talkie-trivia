module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    roots: ["<rootDir>/src"],
    testMatch: ["**/*.test.ts"],
    moduleFileExtensions: ["ts", "js", "json", "node"],
    collectCoverage: true,
    collectCoverageFrom: ["src/**/*.ts", "!src/**/*.test.ts"],
    coverageDirectory: "coverage",
    // Unit-only baseline; account lifecycle behavior also has emulator contracts.
    coverageThreshold: {
        global: { statements: 39, branches: 35, functions: 39, lines: 44 }
    },
    transform: {
        "^.+\\.ts$": ["ts-jest", {
            tsconfig: "<rootDir>/tsconfig.json"
        }]
    }
};
