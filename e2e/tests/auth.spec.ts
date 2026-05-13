/**
 * E2E tests for authentication flows.
 * These tests go through the real login UI — they do NOT use saved auth states.
 */
import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { ADMIN, FACULTY, STUDENT, UNVERIFIED, FIRST_LOGIN } from '../fixtures/users';

test.describe('Login page', () => {
    test('renders the login form', async ({ page }) => {
        const login = new LoginPage(page);
        await login.goto();
        await expect(login.emailInput).toBeVisible();
        await expect(login.passwordInput).toBeVisible();
        await expect(login.submitButton).toBeVisible();
        await expect(login.rememberMeCheckbox).toBeVisible();
    });

    test('shows IIITNR branding', async ({ page }) => {
        await page.goto('/login');
        // Wait for the framer-motion entrance animation to finish (duration: 0.6s)
        await page.waitForLoadState('domcontentloaded');
        // The card animates from opacity:0 — wait for it to become visible
        await expect(page.locator('h1').filter({ hasText: 'IIIT Naya Raipur' })).toBeVisible();
        await expect(page.getByText('Project Management Portal')).toBeVisible();
    });

    test('shows an error for a wrong password', async ({ page }) => {
        const login = new LoginPage(page);
        await login.goto();
        await login.login(STUDENT.email, 'totallywrongpassword');
        await expect(login.errorMessage()).toBeVisible();
        await expect(login.errorMessage()).toContainText(/invalid credentials/i);
    });

    test('shows an error for a non-existent email', async ({ page }) => {
        const login = new LoginPage(page);
        await login.goto();
        await login.login('nobody@iiitnr.ac.in', 'anything');
        await expect(login.errorMessage()).toBeVisible();
    });

    test('redirects admin to /admin after login', async ({ page }) => {
        const login = new LoginPage(page);
        await login.goto();
        await login.login(ADMIN.email, ADMIN.password);
        await page.waitForURL('**/admin', { timeout: 10_000 });
        expect(page.url()).toContain('/admin');
    });

    test('redirects student to /dashboard after login', async ({ page }) => {
        const login = new LoginPage(page);
        await login.goto();
        await login.login(STUDENT.email, STUDENT.password);
        await page.waitForURL('**/dashboard', { timeout: 10_000 });
        expect(page.url()).toContain('/dashboard');
    });

    test('redirects faculty to /dashboard after login', async ({ page }) => {
        const login = new LoginPage(page);
        await login.goto();
        await login.login(FACULTY.email, FACULTY.password);
        await page.waitForURL('**/dashboard', { timeout: 10_000 });
        expect(page.url()).toContain('/dashboard');
    });

    test('shows OTP screen for an unverified user', async ({ page }) => {
        const login = new LoginPage(page);
        await login.goto();
        await login.login(UNVERIFIED.email, UNVERIFIED.password);
        await expect(login.otpInput).toBeVisible({ timeout: 8_000 });
        await expect(login.backToLoginLink).toBeVisible();
        await expect(login.passwordInput).not.toBeVisible();
    });

    test('back to login link restores the login form from OTP mode', async ({ page }) => {
        const login = new LoginPage(page);
        await login.goto();
        await login.login(UNVERIFIED.email, UNVERIFIED.password);
        await expect(login.otpInput).toBeVisible({ timeout: 8_000 });
        await login.backToLoginLink.click();
        await expect(login.passwordInput).toBeVisible();
        await expect(login.submitButton).toBeVisible();
    });

    test('redirects first-login user to /change-password', async ({ page }) => {
        const login = new LoginPage(page);
        await login.goto();
        await login.login(FIRST_LOGIN.email, FIRST_LOGIN.password);
        await page.waitForURL('**/change-password', { timeout: 10_000 });
        expect(page.url()).toContain('/change-password');
    });

    test('unauthenticated access to /dashboard redirects to /login', async ({ page }) => {
        await page.goto('/dashboard');
        await page.waitForURL('**/login', { timeout: 8_000 });
        expect(page.url()).toContain('/login');
    });

    test('unauthenticated access to /admin redirects to /login', async ({ page }) => {
        await page.goto('/admin');
        await page.waitForURL('**/login', { timeout: 8_000 });
        expect(page.url()).toContain('/login');
    });
});
