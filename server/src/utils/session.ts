// Academic-session helpers (Indian 2-semester calendar).
// A "session" labels *when* work happened, independent of student batch, so the
// archive can be filtered by semester across many years.

// Session label for a date:
//   Jul–Dec  → "Odd <Y>-<Y+1>"   (autumn term, start of the academic year)
//   Jan–Jun  → "Even <Y-1>-<Y>"  (spring term of the same academic year)
// e.g. 2026-05 → "Even 2025-26"; 2025-09 → "Odd 2025-26".
export const sessionLabelFor = (date: Date): string => {
    const y = date.getFullYear();
    const m = date.getMonth(); // 0-11
    if (m >= 6) return `Odd ${y}-${String(y + 1).slice(2)}`;
    return `Even ${y - 1}-${String(y).slice(2)}`;
};

// Chronological sort key for a session label. Odd (autumn) precedes Even (spring)
// within the same academic year. Returns 0 for unparseable labels.
export const sessionSortKey = (label: string): number => {
    const match = /^(Odd|Even)\s+(\d{4})-\d{2}$/.exec(label || '');
    if (!match) return 0;
    const [, term, startYear] = match;
    return Number(startYear) * 10 + (term === 'Odd' ? 0 : 1);
};

// Resolve a record's session: explicit stamp, else derived from its archival date.
// Legacy records archived before sessions existed fall back to updatedAt/createdAt.
export const resolveSession = (rec: any): string =>
    rec.archivedSession || sessionLabelFor(new Date(rec.updatedAt || rec.createdAt || Date.now()));
