import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const E2E_MONGO_URI = 'mongodb://localhost:27017/minor_management_e2e';
const JWT_SECRET = 'e2e-playwright-test-secret-do-not-use-in-prod';

export default defineConfig({
    testDir: './tests',

    // Sequential: tests share a single DB and should not run in parallel
    fullyParallel: false,
    workers: 1,

    // Retry once in CI, never locally (keep local runs fast)
    retries: process.env.CI ? 2 : 0,

    timeout: 30_000,

    // Increase per-assertion timeout: default is 5s, but dashboard API calls can take longer
    expect: { timeout: 15_000 },

    reporter: [
        ['list'],
        ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ],

    use: {
        baseURL: 'http://localhost:5173',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'on-first-retry',
    },

    // ── Projects ─────────────────────────────────────────────────────────────
    // 1. "setup" runs first: logs in as each role and saves browser storage state.
    // 2. "e2e" depends on setup: all other tests reuse those saved auth states.
    projects: [
        {
            name: 'setup',
            testMatch: /setup\.spec\.ts/,
        },
        {
            name: 'e2e',
            use: { ...devices['Desktop Chrome'] },
            dependencies: ['setup'],
        },
    ],

    // ── Web servers ───────────────────────────────────────────────────────────
    // Playwright starts both servers before running any tests.
    // They use the E2E database — completely separate from your dev database.
    //
    // IMPORTANT: Stop your local dev servers on ports 5000 and 5173 before
    // running E2E tests, or set reuseExistingServer to false.
    webServer: [
        {
            command: 'npm run dev',
            cwd: path.resolve(__dirname, '../server'),
            port: 5000,
            timeout: 30_000,
            reuseExistingServer: !process.env.CI,
            env: {
                MONGO_URI: E2E_MONGO_URI,
                JWT_SECRET,
                PORT: '5000',
            },
        },
        {
            command: 'npm run dev',
            cwd: path.resolve(__dirname, '../client'),
            port: 5173,
            timeout: 30_000,
            reuseExistingServer: !process.env.CI,
        },
    ],

    globalSetup: './global-setup.ts',
    globalTeardown: './global-teardown.ts',
});
