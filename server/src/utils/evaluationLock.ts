// Freeze rules for a group's own project details (title, description, tags, attachments).
//
// A group may refine its project freely right up to mid-semester evaluation. Once that window
// opens, mentors and panels are grading what was submitted, so the details must stop moving
// under them — the group is locked out for the rest of the semester.

import Event, { EventType } from '../models/Event';

/**
 * Has the CURRENT cycle's mid-semester evaluation window opened?
 *
 * Semester rollover archives groups, projects and panels but never events, so "a mid-term
 * event has started" is not enough on its own — last semester's would freeze every new
 * proposal the moment it was written. The cycle boundary is the newest Group Formation event
 * (every semester opens with one), so a mid-term window only counts if it started after that.
 * Deactivated mid-term windows don't count either, which gives an admin a way to unfreeze.
 */
export const midTermEvaluationOpened = async (): Promise<boolean> => {
    const now = new Date();

    const [midTerm, groupFormation] = await Promise.all([
        Event.findOne({
            type: EventType.MID_TERM_EVALUATION,
            isActive: true,
            startDate: { $lte: now }
        })
            .sort({ startDate: -1 })
            .select('startDate')
            .lean(),
        // Not filtered on isActive: a closed Group Formation window still marks where the
        // current semester began.
        Event.findOne({ type: EventType.GROUP_FORMATION_AND_PROJECT_PROPOSAL })
            .sort({ startDate: -1 })
            .select('startDate')
            .lean(),
    ]);

    if (!midTerm?.startDate) return false;
    if (!groupFormation?.startDate) return true; // nothing to date the cycle from — take it at face value
    return new Date(midTerm.startDate).getTime() > new Date(groupFormation.startDate).getTime();
};

/**
 * Are this project's details frozen? `midTermOpened` comes from midTermEvaluationOpened().
 *
 * A project that already carries a mid-term evaluation is frozen regardless — it has
 * demonstrably been graded, even if the event was since switched off or deleted.
 */
export const projectDetailsFrozen = (project: any, midTermOpened: boolean): boolean =>
    !!project?.midTermEvaluation || midTermOpened;

/** The message shown to a group whose project details are frozen. */
export const DETAILS_FROZEN_MESSAGE =
    'Project details are locked because mid-semester evaluation has begun. Ask your mentor or the admin if something still needs to change.';
