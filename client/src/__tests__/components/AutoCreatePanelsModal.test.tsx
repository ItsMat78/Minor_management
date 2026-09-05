/**
 * Component tests for the auto panel allocator.
 *
 * The allocator runs in a mount effect and reports each panel as "<n> items • <m> groups",
 * so the rendered summaries are read back as (size, load) pairs.
 */
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import AutoCreatePanelsModal from '../../components/AutoCreatePanelsModal';

const MAX_PANEL_SIZE = 4;
const MIN_PANEL_SIZE = 2;

const makeFaculties = (loads: number[]) =>
    loads.map((groupCount, i) => ({
        _id: `fac-${i}`,
        name: `Faculty ${i}`,
        email: `fac${i}@iiitnr.edu.in`,
        groupCount,
    }));

/** Reads back the "<n> items • <m> groups" line the modal renders per panel. */
const readPanels = () =>
    screen
        .queryAllByText(/^\d+ items • \d+ groups$/)
        .map(el => {
            const [, size, load] = el.textContent!.match(/^(\d+) items • (\d+) groups$/)!;
            return { size: Number(size), load: Number(load) };
        });

/**
 * Faculty names per panel, in render order. Panel cards are located from their
 * "Panel N" heading — `bg-neutral-50` is the card root's own class (the empty-panel
 * tile and the sidebar use `/50` and `/30` variants, which are different tokens).
 */
const readRosters = () =>
    screen
        .queryAllByText(/^Panel \d+$/)
        .map(heading => {
            const card = heading.closest('.bg-neutral-50')!;
            return Array.from(card.querySelectorAll('h5')).map(h => h.textContent!);
        });

/** Panel membership ignoring panel order and within-panel order. */
const canonical = (rosters: string[][]) =>
    rosters.map(r => [...r].sort().join('|')).sort();

/**
 * The modal draws at random on mount, so Math.random is pinned for every render —
 * a fixed value keeps the suite reproducible, and varying it varies the seed.
 */
const renderModal = (loads: number[], random = 0.5) => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(random);
    const result = render(
        <AutoCreatePanelsModal
            faculties={makeFaculties(loads)}
            batchYear={2025}
            onClose={() => { }}
            onConfirm={async () => { }}
        />
    );
    spy.mockRestore();
    return result;
};

/** Renders and falls back to the deterministic allocation, for baseline assertions. */
const renderDeterministic = (loads: number[]) => {
    const result = renderModal(loads);
    const fallback = screen.queryByRole('button', { name: /Default Order/i });
    if (fallback) fireEvent.click(fallback);
    return result;
};

const renderAllocator = (loads: number[]) => {
    renderDeterministic(loads);
    return readPanels();
};

/** Redraws with Math.random pinned, so the new seed is reproducible. */
const redraw = (random: number) => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(random);
    fireEvent.click(screen.getByRole('button', { name: /Randomize Assignment/i }));
    spy.mockRestore();
};

const gapOf = (panels: { load: number }[]) =>
    Math.max(...panels.map(p => p.load)) - Math.min(...panels.map(p => p.load));

afterEach(cleanup);

describe('AutoCreatePanelsModal auto-allocation', () => {
    it('splits 5 active faculty instead of building one oversized panel', () => {
        // Previously floor(5 / 3) === 1, so all five landed in a single panel.
        const panels = renderAllocator([6, 5, 4, 3, 2]);

        expect(panels.map(p => p.size).sort()).toEqual([2, 3]);
        expect(panels.map(p => p.load).sort()).toEqual([10, 10]);
    });

    it('keeps every auto-generated panel inside the size band', () => {
        for (let n = 1; n <= 20; n++) {
            const loads = Array.from({ length: n }, (_, i) => (i % 5) + 1);
            const { unmount } = renderDeterministic(loads);
            const sizes = readPanels().map(p => p.size);

            expect(sizes.every(s => s <= MAX_PANEL_SIZE)).toBe(true);
            // A lone panel may fall short of MIN when there simply aren't enough faculty.
            if (sizes.length > 1) {
                expect(sizes.every(s => s >= MIN_PANEL_SIZE)).toBe(true);
            }
            expect(sizes.reduce((a, b) => a + b, 0)).toBe(n);

            unmount();
        }
    });

    it('places every active faculty exactly once and preserves total load', () => {
        const loads = [6, 5, 5, 4, 4, 4, 3, 3, 3, 2, 2, 2, 1, 1];
        const panels = renderAllocator(loads);

        expect(panels.reduce((sum, p) => sum + p.size, 0)).toBe(loads.length);
        expect(panels.reduce((sum, p) => sum + p.load, 0)).toBe(
            loads.reduce((a, b) => a + b, 0)
        );
    });

    it('keeps faculty supervising no groups out of the panels', () => {
        const panels = renderAllocator([4, 3, 2, 0, 0, 0]);

        expect(panels.reduce((sum, p) => sum + p.size, 0)).toBe(3);
        expect(screen.getByText(/Reserve Faculty/)).toBeInTheDocument();
    });

    it('balances supervision load across panels', () => {
        const panels = renderAllocator([8, 7, 6, 5, 4, 3, 2, 1]);
        const busiest = Math.max(...panels.map(p => p.load));
        const quietest = Math.min(...panels.map(p => p.load));

        // Total 36 over three panels; greedy + swap should land within a couple of groups.
        expect(busiest - quietest).toBeLessThanOrEqual(2);
    });

    it('builds no panels when nobody supervises a group', () => {
        expect(renderAllocator([0, 0, 0])).toEqual([]);
    });
});

describe('AutoCreatePanelsModal seeded draws', () => {
    // Repeated group counts are what a real batch looks like, and interchangeable
    // faculty are exactly what a draw is free to move.
    const REALISTIC = [4, 4, 3, 3, 3, 2, 2, 2, 1, 1, 1, 1];

    it('opens on a random draw rather than the deterministic allocation', () => {
        renderModal(REALISTIC);

        expect(screen.getByText(/^Draw #/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Randomize Assignment/i })).toBeInTheDocument();
    });

    it('reproduces the same panels from the same seed', () => {
        const { unmount } = renderModal(REALISTIC, 0.42);
        const first = readRosters();
        const label = screen.getByText(/^Draw #/).textContent;
        unmount();

        renderModal(REALISTIC, 0.42);

        expect(readRosters()).toEqual(first);
        expect(screen.getByText(/^Draw #/).textContent).toBe(label);
    });

    it('reshuffles who sits with whom across seeds', () => {
        const arrangements = new Set<string>();

        for (const random of [0.05, 0.2, 0.37, 0.51, 0.66, 0.78, 0.91]) {
            const { unmount } = renderModal(REALISTIC, random);
            arrangements.add(JSON.stringify(canonical(readRosters())));
            unmount();
        }

        // Panel membership, not just panel order — canonical() sorts both levels away.
        expect(arrangements.size).toBeGreaterThan(1);
    });

    it('redrawing in place also changes the arrangement', () => {
        renderModal(REALISTIC, 0.42);
        const first = canonical(readRosters());
        const firstLabel = screen.getByText(/^Draw #/).textContent;

        redraw(0.77);

        expect(screen.getByText(/^Draw #/).textContent).not.toBe(firstLabel);
        expect(canonical(readRosters())).not.toEqual(first);
    });

    it('never draws a worse-balanced arrangement than the deterministic run', () => {
        const { unmount } = renderDeterministic(REALISTIC);
        const deterministic = gapOf(readPanels());
        unmount();

        // Restart 0 of every draw is the deterministic run, so the best-of-K pick can
        // only tie it or beat it.
        for (const random of [0.05, 0.2, 0.37, 0.51, 0.66, 0.78, 0.91]) {
            const run = renderModal(REALISTIC, random);
            expect(gapOf(readPanels())).toBeLessThanOrEqual(deterministic);
            run.unmount();
        }
    });

    it('keeps every draw inside the size band', () => {
        for (const random of [0.05, 0.2, 0.37, 0.51, 0.66, 0.78, 0.91]) {
            const { unmount } = renderModal(REALISTIC, random);
            const sizes = readPanels().map(p => p.size);

            expect(sizes.every(s => s >= MIN_PANEL_SIZE && s <= MAX_PANEL_SIZE)).toBe(true);
            expect(sizes.reduce((a, b) => a + b, 0)).toBe(REALISTIC.length);
            unmount();
        }
    });

    it('falls back to the deterministic allocation on Default Order', () => {
        renderModal(REALISTIC, 0.42);
        fireEvent.click(screen.getByRole('button', { name: /Default Order/i }));
        const deterministic = readRosters();

        expect(screen.queryByText(/^Draw #/)).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Default Order/i })).not.toBeInTheDocument();

        // Redrawing after the fallback still works, and moves off the fixed order.
        redraw(0.77);
        expect(screen.getByText(/^Draw #/)).toBeInTheDocument();
        expect(canonical(readRosters())).not.toEqual(canonical(deterministic));
    });

    it('offers no draw control while editing existing panels', () => {
        render(
            <AutoCreatePanelsModal
                faculties={makeFaculties(REALISTIC)}
                batchYear={2025}
                onClose={() => { }}
                onConfirm={async () => { }}
                isEditingMode
                initialPanels={[{ id: 'panel-0', faculties: makeFaculties([4, 3, 2]), room: '' }]}
            />
        );

        expect(screen.queryByRole('button', { name: /Randomize Assignment/i })).not.toBeInTheDocument();
        expect(screen.queryByText(/^Draw #/)).not.toBeInTheDocument();
    });

    it('stamps the drawn seed onto every saved panel', () => {
        const saved: any[] = [];
        const spy = vi.spyOn(Math, 'random').mockReturnValue(0.42);
        render(
            <AutoCreatePanelsModal
                faculties={makeFaculties(REALISTIC)}
                batchYear={2025}
                onClose={() => { }}
                onConfirm={async panels => { saved.push(...panels); }}
            />
        );
        spy.mockRestore();

        const seed = Number(screen.getByText(/^Draw #/).textContent!.replace('Draw #', ''));
        fireEvent.click(screen.getByRole('button', { name: /Confirm & Save Panels/i }));

        expect(saved.length).toBeGreaterThan(0);
        expect(saved.every(p => p.seed === seed)).toBe(true);
    });

    it('records no seed once the arrangement has been hand-edited', () => {
        const saved: any[] = [];
        const spy = vi.spyOn(Math, 'random').mockReturnValue(0.42);
        render(
            <AutoCreatePanelsModal
                faculties={makeFaculties(REALISTIC)}
                batchYear={2025}
                onClose={() => { }}
                onConfirm={async panels => { saved.push(...panels); }}
            />
        );
        spy.mockRestore();

        // Deleting a panel returns its faculty to the reserve, so the board no longer
        // matches what the seed produces and the draw claim has to be dropped.
        fireEvent.click(screen.getAllByTitle(/Delete Panel/i)[0]);
        fireEvent.click(screen.getByRole('button', { name: /Confirm & Save Panels/i }));

        expect(saved.length).toBeGreaterThan(0);
        expect(saved.every(p => p.seed === 0)).toBe(true);
    });

    it('records no seed for panels arriving through the edit flow', () => {
        const saved: any[] = [];
        render(
            <AutoCreatePanelsModal
                faculties={makeFaculties(REALISTIC)}
                batchYear={2025}
                onClose={() => { }}
                onConfirm={async panels => { saved.push(...panels); }}
                isEditingMode
                initialPanels={[{ id: 'panel-0', faculties: makeFaculties([4, 3, 2]), room: '' }]}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /Confirm & Save Panels/i }));

        expect(saved.length).toBeGreaterThan(0);
        expect(saved.every(p => p.seed === 0)).toBe(true);
    });
});
