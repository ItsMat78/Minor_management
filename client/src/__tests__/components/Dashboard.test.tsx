/**
 * Component tests for the Dashboard page.
 * Verifies role-based rendering: Admin → AdminDashboard, Faculty → FacultyDashboard,
 * Student → student dashboard UI.
 *
 * Heavy sub-components are mocked to keep tests fast and focused on the branch logic.
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import Dashboard from '../../pages/Dashboard';
import { useAuth } from '../../context/AuthContext';

// ── Module mocks (must be top-level — vi.mock is hoisted) ────────────────────

vi.mock('../../utils/api', () => ({
    default: {
        get: vi.fn().mockResolvedValue({ data: { groups: [], orphanProjects: [] } }),
        post: vi.fn().mockResolvedValue({ data: {} }),
    },
}));

vi.mock('../../context/AuthContext', () => ({
    useAuth: vi.fn(),
}));

vi.mock('../../pages/AdminDashboard', () => ({
    default: () => <div data-testid="admin-dashboard">Admin Dashboard</div>,
}));

vi.mock('../../pages/FacultyDashboard', () => ({
    default: () => <div data-testid="faculty-dashboard">Faculty Dashboard</div>,
}));

vi.mock('../../components/Chat', () => ({
    default: () => <div data-testid="chat">Chat</div>,
}));

vi.mock('../../components/GlobalEventBanner', () => ({
    GlobalEventBanner: () => null,
}));

vi.mock('../../components/FilePreview', () => ({
    default: () => null,
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const mockedUseAuth = vi.mocked(useAuth);

function setAuthUser(role: 'Admin' | 'Faculty' | 'Student', extra: Record<string, unknown> = {}) {
    mockedUseAuth.mockReturnValue({
        user: { _id: 'u1', name: 'Test', email: 't@test.com', role, ...extra } as any,
        logout: vi.fn(),
        activeEvents: [],
        isAuthenticated: true,
        login: vi.fn(),
        loading: false,
        refreshActiveEvents: vi.fn(),
        refreshUser: vi.fn(),
    });
}

function renderDashboard() {
    return render(
        <MemoryRouter>
            <Dashboard />
        </MemoryRouter>
    );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Dashboard – role-based rendering', () => {
    beforeEach(() => vi.clearAllMocks());

    it('renders AdminDashboard for Admin users', () => {
        setAuthUser('Admin');
        renderDashboard();
        expect(screen.getByTestId('admin-dashboard')).toBeInTheDocument();
    });

    it('renders FacultyDashboard for Faculty users', () => {
        setAuthUser('Faculty');
        renderDashboard();
        expect(screen.getByTestId('faculty-dashboard')).toBeInTheDocument();
    });

    it('does not render AdminDashboard or FacultyDashboard for Student users', () => {
        setAuthUser('Student', { rollNumber: '23IT001' });
        renderDashboard();
        expect(screen.queryByTestId('admin-dashboard')).not.toBeInTheDocument();
        expect(screen.queryByTestId('faculty-dashboard')).not.toBeInTheDocument();
    });
});
