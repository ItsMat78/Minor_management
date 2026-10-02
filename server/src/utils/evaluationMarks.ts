// Marks arithmetic shared by every place that turns rubric scores into a student's total.
//
// A student's total is guide + the panel score, where the panel score is the average of the
// two examiners (E1, E2). E2 is optional — a panel may have only one examiner — and when it is
// absent the panel score is just E1. "Absent" means no E2 score was entered at all; an E2 that
// scored 0 is a real score and must still be averaged in.

/** Sum of a rubric section's scores. Blank / missing entries count as 0. */
export const sectionTotal = (section: Record<string, any> | undefined | null): number =>
    Object.values(section || {}).reduce((s: number, v: any) => s + Number(v || 0), 0);

/** Did the evaluator enter anything in this section? A 0 counts; '' / null / missing do not. */
export const sectionEntered = (section: Record<string, any> | undefined | null): boolean =>
    Object.values(section || {}).some(v => v !== '' && v !== null && v !== undefined && !isNaN(Number(v)));

/** The panel score: the E1/E2 average when E2 was entered, otherwise E1 alone. */
export const panelScore = (p1Total: number, p2Total: number, hasE2: boolean): number =>
    hasE2 ? (p1Total + p2Total) / 2 : p1Total;
