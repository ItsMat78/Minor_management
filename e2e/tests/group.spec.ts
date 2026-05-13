/**
 * E2E tests for group formation.
 * Tests the real browser flow: open dialog → Review & Form Group → Confirm & Create.
 *
 * Dialog flow (from Dashboard.tsx):
 *   Step 1: "Create New Group" dialog with member list → button: "Review & Form Group"
 *   Step 2: Confirmation with estimated group number → button: "Confirm & Create"
 *
 * Pre-conditions (global-setup.ts):
 *   - STUDENT has no group
 *   - An active group_formation_project_proposal event exists for batch 2023
 *   - STUDENT.rollNumber starts with "23" → participates in batch 2023
 */
import { test, expect } from '@playwright/test';
import path from 'path';
import { DashboardPage } from '../pages/DashboardPage';

const AUTH = path.join(__dirname, '../.auth');

test.describe('Group formation', () => {
    test.use({ storageState: path.join(AUTH, 'student.json') });

    test('Form Group button opens the Create New Group dialog', async ({ page }) => {
        const dashboard = new DashboardPage(page);
        await dashboard.goto();
        await expect(dashboard.formGroupButton).toBeVisible();
        await dashboard.formGroupButton.click();
        await expect(dashboard.createGroupDialogTitle).toBeVisible();
    });

    test('dialog shows member list and Review & Form Group button', async ({ page }) => {
        const dashboard = new DashboardPage(page);
        await dashboard.goto();
        await dashboard.formGroupButton.click();
        await expect(dashboard.createGroupDialogTitle).toBeVisible();
        // First step shows the member preview and the primary action button
        await expect(page.getByRole('button', { name: 'Review & Form Group' })).toBeVisible();
        await expect(page.getByText('You (Owner)')).toBeVisible();
    });

    test('student can create a solo group and then sees group navigation', async ({ page }) => {
        const dashboard = new DashboardPage(page);
        await dashboard.goto();
        await dashboard.formGroupButton.click();
        await expect(dashboard.createGroupDialogTitle).toBeVisible();

        // Step 1: click "Review & Form Group"
        await page.getByRole('button', { name: 'Review & Form Group' }).click();

        // Step 2: confirmation screen with estimated group number — click "Confirm & Create"
        await expect(page.getByRole('button', { name: 'Confirm & Create' })).toBeVisible({ timeout: 8_000 });
        await page.getByRole('button', { name: 'Confirm & Create' }).click();

        // After creation the sidebar shows group navigation items.
        // Scope to <aside> to avoid matching the breadcrumb header which also says "My Project".
        await expect(page.locator('aside').getByText('My Group')).toBeVisible({ timeout: 10_000 });
        await expect(page.locator('aside').getByText('My Project')).toBeVisible();

        // "Form Group" button should be gone — student is now in a group
        await expect(dashboard.formGroupButton).not.toBeVisible();
    });

    test('after group creation the Form Group button no longer appears', async ({ page }) => {
        // Runs after the creation test — student is now in a group (same DB, same auth state)
        const dashboard = new DashboardPage(page);
        await dashboard.goto();
        await expect(dashboard.formGroupButton).not.toBeVisible();
        // Group nav items are present in the sidebar
        await expect(page.getByText('My Group')).toBeVisible();
    });
});
