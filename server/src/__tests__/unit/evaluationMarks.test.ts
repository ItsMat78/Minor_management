import { sectionTotal, sectionEntered, panelScore } from '../../utils/evaluationMarks';

describe('evaluation marks', () => {
    it('averages E1 with an E2 of 0 instead of dropping it', () => {
        const p2 = { pres: 0, report: 0 };
        expect(sectionEntered(p2)).toBe(true);
        expect(5 + panelScore(1, sectionTotal(p2), sectionEntered(p2))).toBe(5.5);
    });

    it('uses E1 alone when no E2 was entered', () => {
        expect(sectionEntered({})).toBe(false);
        expect(sectionEntered(undefined)).toBe(false);
        expect(sectionEntered({ pres: '' })).toBe(false);
        expect(panelScore(7, 0, false)).toBe(7);
    });

    it('keeps decimals in the average', () => {
        expect(panelScore(7, 4, true)).toBe(5.5);
        expect(panelScore(7.5, 4, true)).toBe(5.75);
    });
});
