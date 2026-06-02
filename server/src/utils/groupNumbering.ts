import Group from '../models/Group';

// Single source of truth for "what number should the next group get?".
//
// Numbers are scoped per batch and counted from ACTIVE (non-archived) groups only.
// Archived groups belong to past sessions and must never reserve a number, otherwise
// a fresh session would continue after the last archived group (e.g. 95 instead of 1).
// Keep every call site on this helper so the archived-exclusion can't drift out of sync.
export const nextActiveGroupNumber = async (batchYear?: string): Promise<number> => {
    const activeGroups = await Group.find({ isArchived: { $ne: true } }).populate('members', 'rollNumber');
    const usedNumbers = new Set<number>();

    activeGroups.forEach(g => {
        let gb = g.targetBatch;
        if (!gb && g.members && g.members.length > 0 && (g.members[0] as any).rollNumber) {
            gb = '20' + (g.members[0] as any).rollNumber.substring(0, 2);
        }
        if (gb === batchYear && g.name) {
            const num = parseInt(g.name, 10);
            if (!isNaN(num)) usedNumbers.add(num);
        }
    });

    let nextNum = 1;
    while (usedNumbers.has(nextNum)) nextNum++;
    return nextNum;
};
