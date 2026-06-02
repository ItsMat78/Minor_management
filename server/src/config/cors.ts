// Single source of truth for allowed browser origins, shared by the REST CORS (app.ts)
// and the Socket.IO CORS (socket.ts) so the two can't drift apart — a mismatch is exactly
// what silently broke chat in production while the REST API kept working.
//
// Defaults cover the known deployments. CORS_ORIGINS (comma-separated) ADDS to them, so a new
// domain or scheme can be allowed via env without a code change — e.g. when prod moves from
// http to https. The https variant of the IIITNR domain is already included, so the SSL switch
// needs no config change.
const DEFAULT_ORIGINS = [
    'https://minor-management.vercel.app',
    'http://localhost:5173',
    'http://minor-project.iiitnr.ac.in',
    'https://minor-project.iiitnr.ac.in',
];

export const allowedOrigins: string[] = Array.from(new Set([
    ...DEFAULT_ORIGINS,
    ...(process.env.CORS_ORIGINS || '')
        .split(',')
        .map(o => o.trim())
        .filter(Boolean),
]));
