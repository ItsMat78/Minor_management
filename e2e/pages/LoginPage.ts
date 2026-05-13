import { Page, Locator } from '@playwright/test';

export class LoginPage {
    readonly emailInput: Locator;
    readonly passwordInput: Locator;
    readonly submitButton: Locator;
    readonly otpInput: Locator;
    readonly rememberMeCheckbox: Locator;
    readonly backToLoginLink: Locator;

    constructor(private page: Page) {
        this.emailInput = page.getByPlaceholder('Institute Email ID');
        this.passwordInput = page.getByPlaceholder('Password');
        this.submitButton = page.getByRole('button', { name: /sign in/i });
        this.otpInput = page.getByPlaceholder('Enter 6-digit OTP');
        this.rememberMeCheckbox = page.getByLabel(/remember me/i);
        this.backToLoginLink = page.getByText(/back to login/i);
    }

    async goto() {
        await this.page.goto('/login');
    }

    async login(email: string, password: string) {
        await this.emailInput.fill(email);
        await this.passwordInput.fill(password);
        await this.submitButton.click();
    }

    errorMessage() {
        // The error div contains a warning emoji followed by the message text
        return this.page.locator('.text-red-600').first();
    }

    infoMessage() {
        return this.page.locator('.text-blue-700').first();
    }
}
