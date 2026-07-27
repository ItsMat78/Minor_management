// Pull a usable reason out of an axios error.
//
// `err.response.data.message` on its own is not enough, because the two failures that are
// hardest to diagnose never populate it:
//
//   - A rejection from the reverse proxy rather than the app (nginx answering 413 when a file
//     exceeds client_max_body_size) has a status but an HTML body, so `message` is undefined.
//   - A request blocked or dropped before a response exists (CORS, TLS, server down) has no
//     `response` at all.
//
// Both used to surface as a bare "failed" with nothing to act on, which is how a 1MB proxy
// limit went unnoticed. Always say which of the three happened.
export const errorMessage = (err: any, fallback: string): string => {
    const res = err?.response;
    if (!res) return `${fallback} The server could not be reached.`;

    const serverMessage = typeof res.data?.message === 'string' ? res.data.message : null;
    if (serverMessage) return serverMessage;

    if (res.status === 413) return 'That file is too large to upload. Try one under 10MB.';
    return `${fallback} The server returned ${res.status}.`;
};
