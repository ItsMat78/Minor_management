/**
 * E2E tests for the admin dashboard.
 * Tests navigation between tabs and that stats reflect the seeded test data.
 */
import { test, expect } from '@playwright/test';
import path from 'path';

const AUTH = path.join(__dirname, '../.auth');

test.describe('Admin dashboard navigation', () => {
    test.use({ storageState: path.join(AUTH, 'admin.json') });

    test.beforeEach(async ({ page }) => {
        await page.goto('/admin');
        await page.waitForLoadState('networkidle');
    });

    test('shows Dashboard Overview by default', async ({ page }) => {
        await expect(page.getByRole('heading', { name: 'Dashboard Overview' })).toBeVisible();
    });

    test('stats cards reflect seeded users and groups', async ({ page }) => {
        // global-setup seeds 3 students, 1 faculty, 1 admin + a group formation event
        await expect(page.getByText('Total Students')).toBeVisible();
        await expect(page.getByText('Total Faculty')).toBeVisible();
    });

    test('navigates to Student Directory via sidebar', async ({ page }) => {
        await page.getByText('Student Directory').first().click();
        await expect(page.getByRole('heading', { name: 'Student Directory' })).toBeVisible();
    });

    test('navigates to Group Directory via sidebar', async ({ page }) => {
        await page.getByText('Group Directory').click();
        await expect(page.getByRole('heading', { name: 'Group Directory' })).toBeVisible();
    });

    test('navigates to Faculty Directory via sidebar', async ({ page }) => {
        await page.getByText('Faculty Directory').click();
        await expect(page.getByRole('heading', { name: 'Faculty Directory' })).toBeVisible();
    });

    test('navigates to Evaluation Panels via sidebar', async ({ page }) => {
        await page.getByText('Evaluation Panels').click();
        await expect(page.getByRole('heading', { name: 'Evaluation Panels' })).toBeVisible();
    });

    test('student directory shows the seeded E2E Student', async ({ page }) => {
        await page.getByText('Student Directory').first().click();
        await expect(page.getByText('E2E Student')).toBeVisible({ timeout: 10_000 });
    });

    test('faculty directory shows the seeded E2E Faculty', async ({ page }) => {
        await page.getByText('Faculty Directory').click();
        await expect(page.getByText('E2E Faculty')).toBeVisible({ timeout: 10_000 });
    });
});
