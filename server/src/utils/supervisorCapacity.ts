import Project from '../models/Project';

/** Fallback when a faculty account has no explicit cap set. Matches the User schema default. */
export const DEFAULT_MAX_STUDENTS = 21;

export interface SupervisorLoad {
    /** Students already committed to this supervisor this semester, across every batch. */
    currentStudents: number;
    /** The supervisor's semester-wide ceiling. */
    maxStudents: number;
    /** Students the group under consideration would add. */
    incoming: number;
    /** True when taking `incoming` on would push them past `maxStudents`. */
    exceeded: boolean;
    /** Places still free. Never negative. */
    remaining: number;
}

/**
 * Students a supervisor is already committed to this semester, summed across every batch they
 * mentor. `excludeProjectId` drops one project so it can't be double-counted — the project being
 * approved, reassigned or edited right now.
 *
 * Only Approved projects count. Pending proposals deliberately do not: a mentor may still reject
 * them, and counting them would let one group's unapproved proposal hold a place against everyone
 * else. The consequence is that a supervisor can accumulate more pending proposals than they have
 * places for, which is why the approval-time check remains the authority and the submit-time check
 * is only an early warning.
 */
export const approvedStudentLoad = async (facultyId: any, excludeProjectId?: any): Promise<number> => {
    const approved = await Project.find({
        faculty: facultyId,
        status: 'Approved',
        isArchived: { $ne: true }, // current semester only — past-semester archives don't count
        ...(excludeProjectId ? { _id: { $ne: excludeProjectId } } : {})
    }).populate({ path: 'group', populate: { path: 'members' } });

    return approved.reduce((sum: number, p: any) => sum + (p.group?.members?.length || 0), 0);
};

/**
 * The single place that decides whether a supervisor can take on a group of `incoming` students.
 *
 * Each caller phrases its own refusal — the wording differs for a student picking a mentor, a
 * mentor approving a proposal, and an admin reassigning a group — but the arithmetic lives here
 * so the three cannot drift apart.
 *
 * The student count is the hard ceiling. `maxGroups` is deliberately NOT enforced: small groups
 * can legitimately push the group total past the 7-group guideline while staying well under the
 * student cap, so it stays a display-only hint.
 */
export const supervisorCapacity = async (
    faculty: { _id: any; maxStudents?: number },
    incoming: number,
    excludeProjectId?: any
): Promise<SupervisorLoad> => {
    const maxStudents = faculty.maxStudents ?? DEFAULT_MAX_STUDENTS;
    const currentStudents = await approvedStudentLoad(faculty._id, excludeProjectId);

    return {
        currentStudents,
        maxStudents,
        incoming,
        exceeded: currentStudents + incoming > maxStudents,
        remaining: Math.max(0, maxStudents - currentStudents)
    };
};

/**
 * The refusal a STUDENT sees when they try to submit to a mentor with no room. It names the
 * shortfall and both ways forward, because a student can do nothing about the limit itself —
 * unlike the admin-facing wording, which points at the Faculty tab.
 */
export const mentorFullMessage = (facultyName: string, load: SupervisorLoad): string => {
    const { currentStudents, maxStudents, incoming, remaining } = load;
    const places = remaining === 0
        ? 'no places left'
        : `only ${remaining} place${remaining === 1 ? '' : 's'} left`;

    return `${facultyName} has ${places} this semester (already mentoring ${currentStudents} of ${maxStudents} students), and your group needs ${incoming}. Pick a different mentor, or save this as a draft and submit it if a place frees up.`;
};
