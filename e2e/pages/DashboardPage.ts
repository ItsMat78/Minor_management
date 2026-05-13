import { Page, Locator } from '@playwright/test';

export class DashboardPage {
    readonly signOutButton: Locator;
    readonly formGroupButton: Locator;
    readonly studentDirectoryHeading: Locator;
    readonly createGroupDialogTitle: Locator;

    constructor(private page: Page) {
        this.signOutButton = page.getByRole('button', { name: /sign out/i });
        this.formGroupButton = page.getByRole('button', { name: /form group/i });
        this.studentDirectoryHeading = page.getByRole('heading', { name: 'Student Directory' });
        this.createGroupDialogTitle = page.getByRole('heading', { name: 'Create New Group' });
    }

    async goto() {
        await this.page.goto('/dashboard');
        // The dashboard shows a loading spinner (.animate-spin) while making initial API calls.
        // Wait for it to disappear — that means loading is done and real content is visible.
        // Note: we cannot use waitForLoadState('networkidle') because the app holds
        // a persistent Socket.io WebSocket connection which prevents networkidle.
        await this.page.locator('.animate-spin').first().waitFor({ state: 'hidden', timeout: 20_000 }).catch(() => {});
    }

    sidebarItem(label: string) {
        return this.page.getByText(label, { exact: true });
    }
}
