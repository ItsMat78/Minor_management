/**
 * E2E tests for role-based dashboard rendering.
 * Uses saved auth states so these tests skip the login form.
 */
import { test, expect } from '@playwright/test';
import path from 'path';
import { DashboardPage } from '../pages/DashboardPage';

const AUTH = path.join(__dirname, '../.auth');

// ── Admin ─────────────────────────────────────────────────────────────────────

test.describe('Admin dashboard', () => {
    test.use({ storageState: path.join(AUTH, 'admin.json') });

    test('admin lands on /admin route', async ({ page }) => {
        await page.goto('/admin');
        await expect(page).toHaveURL(/\/admin/);
    });

    test('admin dashboard shows Dashboard Overview heading', async ({ page }) => {
        await page.goto('/admin');
        await page.waitForLoadState('networkidle');
        // AdminDashboard default tab shows 'Dashboard Overview'
        await expect(page.getByRole('heading', { name: 'Dashboard Overview' })).toBeVisible();
    });

    test('admin /admin page stays on /admin (not redirected to login)', async ({ page }) => {
        await page.goto('/admin');
        await page.waitForLoadState('networkidle');
        await expect(page).toHaveURL(/\/admin/);
        await expect(page).not.toHaveURL(/\/login/);
    });

    test('admin on /dashboard sees admin content (not student directory)', async ({ page }) => {
        // Admin navigating to /dashboard renders AdminDashboard sub-component (same content)
        await page.goto('/dashboard');
        await page.waitForLoadState('networkidle');
        // Student Directory is a student-only view — admin should not see it
        await expect(page.getByRole('heading', { name: 'Student Directory' })).not.toBeVisible();
    });
});

// ── Faculty ───────────────────────────────────────────────────────────────────

test.describe('Faculty dashboard', () => {
    test.use({ storageState: path.join(AUTH, 'faculty.json') });

    test('faculty lands on /dashboard', async ({ page }) => {
        const dashboard = new DashboardPage(page);
        await dashboard.goto();
        await expect(page).toHaveURL(/\/dashboard/);
    });

    test('faculty dashboard shows Faculty Portal sidebar header', async ({ page }) => {
        const dashboard = new DashboardPage(page);
        await dashboard.goto();
        await expect(page.getByText('Faculty Portal')).toBeVisible();
    });

    test('faculty dashboard does not show student directory heading', async ({ page }) => {
        const dashboard = new DashboardPage(page);
        await dashboard.goto();
        await expect(dashboard.studentDirectoryHeading).not.toBeVisible();
    });

    test('faculty can sign out', async ({ page }) => {
        const dashboard = new DashboardPage(page);
        await dashboard.goto();
        await expect(dashboard.signOutButton).toBeVisible();
        await dashboard.signOutButton.click();
        await page.waitForURL('**/login', { timeout: 8_000 });
        expect(page.url()).toContain('/login');
    });
});

// ── Student ───────────────────────────────────────────────────────────────────

test.describe('Student dashboard', () => {
    test.use({ storageState: path.join(AUTH, 'student.json') });

    test('student lands on /dashboard', async ({ page }) => {
        const dashboard = new DashboardPage(page);
        await dashboard.goto();
        await expect(page).toHaveURL(/\/dashboard/);
    });

    test('student without a group sees the Student Directory heading', async ({ page }) => {
        const dashboard = new DashboardPage(page);
        await dashboard.goto();
        await expect(dashboard.studentDirectoryHeading).toBeVisible();
    });

    test('student sees "Form Group" button because a group formation event is active', async ({ page }) => {
        const dashboard = new DashboardPage(page);
        await dashboard.goto();
        await expect(dashboard.formGroupButton).toBeVisible();
    });

    test('student sees own name in the sidebar', async ({ page }) => {
        const dashboard = new DashboardPage(page);
        await dashboard.goto();
        // Use aside scope to avoid matching the same name in the student directory table
        await expect(page.locator('aside').getByText('E2E Student')).toBeVisible();
    });

    test('student can sign out', async ({ page }) => {
        const dashboard = new DashboardPage(page);
        await dashboard.goto();
        await expect(dashboard.signOutButton).toBeVisible();
        await dashboard.signOutButton.click();
        await page.waitForURL('**/login', { timeout: 8_000 });
        expect(page.url()).toContain('/login');
    });

    test('student is redirected from /admin to /dashboard (not admin)', async ({ page }) => {
        await page.goto('/admin');
        // ProtectedRoute with adminOnly redirects non-admins to /dashboard
        await page.waitForURL('**/dashboard', { timeout: 8_000 });
        expect(page.url()).not.toContain('/admin');
    });
});
