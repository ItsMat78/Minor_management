// A student's branch is encoded in the 5th character (index 4) of their roll number.
// Centralised here so every place that sets or changes a roll number derives the same branch.

export const BRANCH_BY_ROLL_DIGIT: Record<string, string> = {
    '0': 'CSE',
    '1': 'ECE',
    '2': 'DSAI',
};

/** Branch encoded in a roll number, or null if it is too short or the digit is unrecognised. */
export const branchFromRoll = (roll: string | undefined | null): string | null => {
    const r = String(roll || '');
    if (r.length < 5) return null;
    return BRANCH_BY_ROLL_DIGIT[r[4]] ?? null;
};
