/** @type {import('jest').Config} */
const config = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/src'],
    testMatch: ['**/__tests__/**/*.test.ts'],
    setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup/jestSetup.ts'],
    coverageDirectory: 'coverage',
    collectCoverageFrom: [
        'src/**/*.ts',
        '!src/__tests__/**',
        '!src/index.ts',
        '!src/scripts/**',
        '!src/socket.ts',
    ],
    // First run downloads the MongoDB binary (~70MB) — allow generous timeout.
    // Subsequent runs use the cache and are much faster.
    testTimeout: 60000,
    silent: false,
    verbose: true,
};

module.exports = config;
