/**
 * Auth setup — runs once in the "setup" project before any real tests.
 * Logs in as each role and saves browser storage state (localStorage + cookies)
 * so subsequent tests can skip the login form.
 *
 * IMPORTANT: "Remember me" is checked so the token is stored in localStorage.
 * Playwright's storageState() saves localStorage but NOT sessionStorage (which
 * is ephemeral). Without "Remember me", the saved state would be empty and all
 * dashboard tests would be redirected to /login.
 *
 * Output files: e2e/.auth/{admin,faculty,student}.json
 */
import { test as setup } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { ADMIN, FACULTY, STUDENT } from '../fixtures/users';

const AUTH = path.join(__dirname, '../.auth');

setup.beforeAll(() => {
    fs.mkdirSync(AUTH, { recursive: true });
});

async function loginAndSave(page: any, email: string, password: string, waitUrl: string, file: string) {
    await page.goto('/login');
    await page.getByPlaceholder('Institute Email ID').fill(email);
    await page.getByPlaceholder('Password').fill(password);
    // Check "Remember me" → token stored in localStorage (required for storageState to work)
    await page.getByLabel(/remember me/i).check();
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(`**${waitUrl}`, { timeout: 15_000 });
    await page.context().storageState({ path: file });
}

setup('create admin auth state', async ({ page }) => {
    await loginAndSave(page, ADMIN.email, ADMIN.password, '/admin', path.join(AUTH, 'admin.json'));
});

setup('create faculty auth state', async ({ page }) => {
    await loginAndSave(page, FACULTY.email, FACULTY.password, '/dashboard', path.join(AUTH, 'faculty.json'));
});

setup('create student auth state', async ({ page }) => {
    await loginAndSave(page, STUDENT.email, STUDENT.password, '/dashboard', path.join(AUTH, 'student.json'));
});
