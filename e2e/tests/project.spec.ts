/**
 * E2E tests for the project proposal flow.
 *
 * Depends on group.spec.ts having run first (alphabetical order means this runs after group.spec.ts).
 * The student will already have a group in the DB from that test, which is required to access
 * /project/propose.
 *
 * Proposal form (ProjectProposal.tsx) has 2 steps:
 *   Step 1: Title (required), Description (required), Tags, Links, Attachments
 *           Buttons: "Save as Draft" | "Next Step"
 *   Step 2: Select Faculty Mentor (optional — "No Faculty" option exists)
 *           Buttons: "Save as Draft" | "Submit Proposal"
 */
import { test, expect } from '@playwright/test';
import path from 'path';
import { DashboardPage } from '../pages/DashboardPage';
import { FACULTY } from '../fixtures/users';

const AUTH = path.join(__dirname, '../.auth');

test.describe('Project Proposal', () => {
    test.use({ storageState: path.join(AUTH, 'student.json') });

    test('proposal form loads at /project/propose', async ({ page }) => {
        await page.goto('/project/propose');
        await expect(page.getByRole('heading', { name: 'New Project Proposal' })).toBeVisible();
        await expect(page.getByText('Step 1 of 2')).toBeVisible();
    });

    test('step 1 shows validation error if title is empty', async ({ page }) => {
        await page.goto('/project/propose');
        // Click Next Step without filling title
        await page.getByRole('button', { name: 'Next Step' }).click();
        await expect(page.getByText('Please fill in all fields')).toBeVisible();
    });

    test('student can save a project as Draft from step 1', async ({ page }) => {
        await page.goto('/project/propose');
        await page.getByPlaceholder('e.g. Smart Traffic Management System').fill('E2E Draft Project');
        await page.getByPlaceholder('Describe the problem, solution, and scope...').fill('A draft project created by E2E tests.');
        await page.getByRole('button', { name: 'Save as Draft' }).click();
        // On success, navigate back to dashboard
        await page.waitForURL('**/', { timeout: 10_000 });
        const dashboard = new DashboardPage(page);
        await dashboard.goto();
        // After having a project draft, the sidebar shows "My Project"
        await expect(page.locator('aside').getByText('My Project')).toBeVisible();
    });

    test('student can submit a Pending proposal through both steps', async ({ page }) => {
        await page.goto('/project/propose');
        await page.waitForLoadState('domcontentloaded');

        // Step 1 — fill required fields
        await page.getByPlaceholder('e.g. Smart Traffic Management System').fill('E2E Test: IoT Smart Campus');
        await page.getByPlaceholder('Describe the problem, solution, and scope...').fill(
            'An IoT system to monitor and optimise campus energy usage using sensor networks.'
        );
        await page.getByPlaceholder('AI, Machine Learning, Web App').fill('IoT, Sensors, Embedded');
        await page.getByRole('button', { name: 'Next Step' }).click();

        // Step 2 — wait for faculty list to load then select E2E Faculty
        await expect(page.getByText('Step 2 of 2')).toBeVisible({ timeout: 5_000 });
        // The faculty list loads via API call — wait for the faculty name to appear
        await expect(page.getByText(FACULTY.name)).toBeVisible({ timeout: 10_000 });
        await page.locator('label').filter({ hasText: FACULTY.name }).first().click();
        // Submit
        await page.getByRole('button', { name: 'Submit Proposal' }).click();

        // On success, redirected back to root → dashboard
        await page.waitForURL('**/', { timeout: 10_000 });
    });

    test('after proposal submission the dashboard shows ProposalPending status', async ({ page }) => {
        const dashboard = new DashboardPage(page);
        await dashboard.goto();
        // Student with a pending proposal sees "My Project" in the sidebar
        await expect(page.locator('aside').getByText('My Project')).toBeVisible();
    });
});

test.describe('Faculty sees submitted proposal', () => {
    test.use({ storageState: path.join(AUTH, 'faculty.json') });

    test('faculty dashboard shows the pending proposal from the student', async ({ page }) => {
        const dashboard = new DashboardPage(page);
        await dashboard.goto();
        // FacultyDashboard defaults to "mentees" tab (Approved projects only).
        // Switch to "Project Proposals" tab to see Pending proposals.
        await page.getByText('Project Proposals').click();
        // The project title submitted in the previous test: "E2E Test: IoT Smart Campus"
        await expect(page.getByText(/IoT Smart Campus/i)).toBeVisible({ timeout: 10_000 });
    });
});
