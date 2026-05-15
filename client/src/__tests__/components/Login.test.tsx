/**
 * Component tests for the Login page.
 *
 * Strategy: mock the `api` axios instance and the `AuthContext` hook so this test
 * never hits a real server. Tests verify rendered output and user-visible behaviour.
 *
 * If framer-motion animations cause test flakiness, uncomment the mock below:
 *
 * vi.mock('framer-motion', () => ({
 *   motion: { div: ({ children, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div {...p}>{children}</div> },
 *   AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
 * }));
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import Login from '../../pages/Login';
import api from '../../utils/api';

// ── Module mocks ────────────────────────────────────────────────────────────

vi.mock('../../utils/api', () => ({
    default: {
        post: vi.fn(),
    },
}));

vi.mock('../../context/AuthContext', () => ({
    useAuth: () => ({
        login: vi.fn(),
        isAuthenticated: false,
        user: null,
    }),
}));

// ── Helpers ─────────────────────────────────────────────────────────────────

const mockedApiPost = vi.mocked(api.post);

function renderLogin() {
    return render(
        <MemoryRouter>
            <Login />
        </MemoryRouter>
    );
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Login page – initial render', () => {
    beforeEach(() => vi.clearAllMocks());

    it('renders the email and password inputs', () => {
        renderLogin();
        expect(screen.getByPlaceholderText('Institute Email ID')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
    });

    it('renders the Sign In submit button', () => {
        renderLogin();
        expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });

    it('renders the Remember me checkbox', () => {
        renderLogin();
        expect(screen.getByLabelText(/remember me/i)).toBeInTheDocument();
    });
});

describe('Login page – error handling', () => {
    beforeEach(() => vi.clearAllMocks());

    it('shows the server error message on failed login', async () => {
        mockedApiPost.mockRejectedValueOnce({
            response: { data: { message: 'Invalid credentials' } },
        });
        renderLogin();

        fireEvent.change(screen.getByPlaceholderText('Institute Email ID'), {
            target: { value: 'wrong@iiitnr.ac.in' },
        });
        fireEvent.change(screen.getByPlaceholderText('Password'), {
            target: { value: 'badpassword' },
        });
        fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

        await waitFor(() => {
            expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
        });
    });

    it('shows a generic fallback message when there is no server response', async () => {
        mockedApiPost.mockRejectedValueOnce(new Error('Network Error'));
        renderLogin();

        fireEvent.change(screen.getByPlaceholderText('Institute Email ID'), {
            target: { value: 'x@iiitnr.ac.in' },
        });
        fireEvent.change(screen.getByPlaceholderText('Password'), {
            target: { value: 'password' },
        });
        fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

        await waitFor(() => {
            expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
        });
    });
});

describe('Login page – OTP mode transition', () => {
    beforeEach(() => vi.clearAllMocks());

    it('switches to OTP mode when the server returns requiresActivation', async () => {
        mockedApiPost.mockResolvedValueOnce({
            data: {
                requiresActivation: true,
                email: 'unverified@iiitnr.ac.in',
                message: 'OTP sent to your email.',
            },
        });
        renderLogin();

        fireEvent.change(screen.getByPlaceholderText('Institute Email ID'), {
            target: { value: 'unverified@iiitnr.ac.in' },
        });
        fireEvent.change(screen.getByPlaceholderText('Password'), {
            target: { value: 'pass123' },
        });
        fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

        await waitFor(() => {
            expect(screen.getByPlaceholderText('Enter 6-digit OTP')).toBeInTheDocument();
        });
        // Email and password inputs should no longer be visible
        expect(screen.queryByPlaceholderText('Password')).not.toBeInTheDocument();
    });

    it('shows a "Back to login" link in OTP mode', async () => {
        mockedApiPost.mockResolvedValueOnce({
            data: { requiresActivation: true, email: 'u@iiitnr.ac.in', message: '' },
        });
        renderLogin();

        fireEvent.change(screen.getByPlaceholderText('Institute Email ID'), {
            target: { value: 'u@iiitnr.ac.in' },
        });
        fireEvent.change(screen.getByPlaceholderText('Password'), {
            target: { value: 'pass' },
        });
        fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

        await waitFor(() => screen.getByPlaceholderText('Enter 6-digit OTP'));
        expect(screen.getByText(/back to login/i)).toBeInTheDocument();
    });

    it('returns to login form when "Back to login" is clicked', async () => {
        mockedApiPost.mockResolvedValueOnce({
            data: { requiresActivation: true, email: 'u@iiitnr.ac.in', message: '' },
        });
        renderLogin();

        fireEvent.change(screen.getByPlaceholderText('Institute Email ID'), {
            target: { value: 'u@iiitnr.ac.in' },
        });
        fireEvent.change(screen.getByPlaceholderText('Password'), {
            target: { value: 'pass' },
        });
        fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

        await waitFor(() => screen.getByPlaceholderText('Enter 6-digit OTP'));
        fireEvent.click(screen.getByText(/back to login/i));

        await waitFor(() => {
            expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
        });
    });
});
