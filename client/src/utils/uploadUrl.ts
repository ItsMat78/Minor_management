// Uploaded-file URLs are stored in the database as ABSOLUTE urls, built at upload time from
// `UPLOAD_BASE_URL` or, when that is unset, from whatever host the request happened to arrive
// on (see server/src/middleware/uploadMiddleware.ts → publicUrlFor). That bakes a host into the
// row forever, so a file uploaded while the API was reached at http://localhost:5000, a LAN IP,
// or over plain http behind a TLS proxy stays pointed at that dead/blocked origin for every
// later viewer — the classic "this one person's photo doesn't load" bug.
//
// Rather than migrate the data, resolve at render time: keep only the /uploads/... suffix and
// re-attach the API origin this client is actually talking to. Rows written before or after any
// server config change then all resolve correctly.
const API_ORIGIN = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export const resolveUploadUrl = (url?: string | null): string | undefined => {
    if (!url) return undefined;
    const idx = url.indexOf('/uploads/');
    if (idx === -1) return url; // not one of ours (e.g. an external avatar) — leave it alone
    return API_ORIGIN + url.slice(idx);
};
