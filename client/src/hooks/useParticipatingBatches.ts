import { useState, useEffect } from 'react';
import api from '../utils/api';

/**
 * Returns the list of participating batch years from the currently active
 * Group Formation event. Falls back to the last 4 years if no active event
 * exists (so dropdowns are never empty during initial setup or off-season).
 *
 * Return shape:
 *   batches       — string[] of 4-digit year strings, e.g. ["2022", "2024"]
 *   loading       — true while the first fetch is in flight
 *   hasFallback   — true when no active GF event was found and we fell back
 */
export function useParticipatingBatches() {
    const [batches, setBatches] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [hasFallback, setHasFallback] = useState(false);

    useEffect(() => {
        let cancelled = false;
        async function fetch() {
            try {
                const res = await api.get('/events/participating-batches');
                const pb: string[] = res.data?.participatingBatches ?? [];
                if (cancelled) return;

                if (pb.length > 0) {
                    setBatches(pb);
                    setHasFallback(false);
                } else {
                    // No active GF event — show last 4 years as a sensible fallback
                    const currentYear = new Date().getFullYear();
                    const fallback = Array.from({ length: 4 }, (_, i) => (currentYear - 3 + i).toString());
                    setBatches(fallback);
                    setHasFallback(true);
                }
            } catch {
                if (cancelled) return;
                const currentYear = new Date().getFullYear();
                const fallback = Array.from({ length: 4 }, (_, i) => (currentYear - 3 + i).toString());
                setBatches(fallback);
                setHasFallback(true);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        fetch();
        return () => { cancelled = true; };
    }, []);

    return { batches, loading, hasFallback };
}
