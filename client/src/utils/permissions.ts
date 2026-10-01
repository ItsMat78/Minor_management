// Mirror of server/src/utils/permissions.ts — the server enforces these; the client only uses
// them to hide what the server would refuse. Keep the two lists in sync.
export type Permission =
    | 'stats' | 'events' | 'events.delete' | 'groups' | 'proposals' | 'panels' | 'evaluations'
    | 'exports' | 'archive' | 'users' | 'settings' | 'accounts' | 'rollover' | 'snapshot' | 'audit';

const COORDINATOR: Permission[] = ['stats', 'events', 'groups', 'proposals', 'panels', 'evaluations', 'exports', 'archive'];

export const hasPermission = (role: string | undefined | null, permission: Permission): boolean => {
    if (role === 'Admin') return true;
    if (role === 'Coordinator') return COORDINATOR.includes(permission);
    return false;
};

// Staff = the dashboard-level roles (admin and the yearly coordinator).
export const isStaff = (role: string | undefined | null): boolean => role === 'Admin' || role === 'Coordinator';
