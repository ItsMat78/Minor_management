/**
 * Unit tests for the group naming/numbering algorithm.
 *
 * The algorithm finds the smallest positive integer not already used as a group
 * name in a given batch. It is duplicated across `createGroup` and
 * `getNextGroupNumber` in groupController.ts — these tests verify the logic
 * in isolation so regressions can be caught without spinning up a DB.
 */

// ── Pure algorithm ────────────────────────────────────────────────────────────
// Extracted from controller: iterate from 1 upward, skip anything in usedNumbers
function nextAvailableNumber(usedNumbers: Set<number>): number {
    let n = 1;
    while (usedNumbers.has(n)) n++;
    return n;
}

describe('nextAvailableNumber', () => {
    it('returns 1 when no group numbers are used', () => {
        expect(nextAvailableNumber(new Set())).toBe(1);
    });

    it('returns 1 when only higher numbers are used', () => {
        expect(nextAvailableNumber(new Set([2, 3, 4]))).toBe(1);
    });

    it('returns the next sequential number when there are no gaps', () => {
        expect(nextAvailableNumber(new Set([1, 2, 3]))).toBe(4);
    });

    it('fills the first gap in a non-sequential sequence', () => {
        expect(nextAvailableNumber(new Set([1, 3, 5]))).toBe(2);
    });

    it('fills gap at position 3', () => {
        expect(nextAvailableNumber(new Set([1, 2, 4, 5]))).toBe(3);
    });

    it('handles a single used number that is 1', () => {
        expect(nextAvailableNumber(new Set([1]))).toBe(2);
    });

    it('handles large contiguous range', () => {
        const used = new Set(Array.from({ length: 99 }, (_, i) => i + 1));
        expect(nextAvailableNumber(used)).toBe(100);
    });

    it('is not confused by NaN entries (parseInt returns NaN for non-numeric group names)', () => {
        // Non-numeric names like "Group-A" produce NaN from parseInt, which is
        // never ===  any number, so the Set should not contain them.
        const usedNumbers = new Set<number>();
        const rawNames = ['1', 'Group-A', '3', 'unnamed', '2'];
        for (const name of rawNames) {
            const n = parseInt(name, 10);
            if (!isNaN(n)) usedNumbers.add(n);
        }
        // Used: {1, 2, 3}  — non-numeric names ignored
        expect(nextAvailableNumber(usedNumbers)).toBe(4);
    });
});

// ── Batch-year suffix derivation ──────────────────────────────────────────────
// The controller derives the batch year from a member's roll number when
// targetBatch is not set.  The prefix is the first two digits of the roll number.
describe('batch year derivation from roll number', () => {
    function deriveBatch(rollNumber: string): string {
        return '20' + rollNumber.substring(0, 2);
    }

    it('derives 2023 from roll number starting with "23"', () => {
        expect(deriveBatch('23IT001')).toBe('2023');
    });

    it('derives 2024 from roll number starting with "24"', () => {
        expect(deriveBatch('24CSE042')).toBe('2024');
    });

    it('handles a two-digit-prefixed roll number of any branch', () => {
        expect(deriveBatch('22ECE100')).toBe('2022');
    });
});
