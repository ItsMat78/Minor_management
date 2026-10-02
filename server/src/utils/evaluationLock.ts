// Freeze rule for a group's own project details (title, description, tags, attachments).
//
// The admin decides when the details stop moving: a toggle in Setup Events (stored on the global
// Settings document) locks every group out of editing at once, and turning it off reopens
// editing. It is not tied to any evaluation window — the admin flips it when mentors and panels
// need a fixed project to grade. Mentors and staff can still edit regardless (see
// updateProjectDetails), which is what the message below promises.

import { getGlobalSettings } from '../models/Settings';

/** Has the admin locked project details? */
export const projectDetailsLocked = async (): Promise<boolean> =>
    !!(await getGlobalSettings()).projectDetailsLocked;

/** The message shown to a group whose project details are locked. */
export const DETAILS_FROZEN_MESSAGE =
    'Project title and description are locked by the admin. Ask your mentor or the admin if something still needs to change.';
