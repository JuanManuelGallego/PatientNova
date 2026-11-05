import { useCallback, useEffect, useRef, useState } from "react";
import type { SaveStatus } from "@/src/components/Info/SaveStatusIndicator";
import { ERR_SAVE } from "@/src/constants/ui";

export const AUTO_SAVE_DEBOUNCE_MS = 1000;
const SAVE_STATUS_CLEAR_MS = 3000;

const keyOf = (value: unknown) => JSON.stringify(value);

type Options<T> = {
    /** The value already on the server; scheduling it again saves nothing. */
    initial?: T;
    delay?: number;
    /**
     * Skip a value equal to the last one sent. Compares by JSON, so turn it off for payloads too large to
     * serialise on every keystroke (e.g. medical records with embedded documents).
     */
    dedupe?: boolean;
};

/**
 * The app's one debounced autosave (profile, reminders, medical records, online booking).
 *
 * - `schedule(value)` restarts the debounce; with `dedupe`, a value equal to the last one sent (or `initial`) cancels the pending save.
 * - `cancel()` drops the pending save (e.g. the form became invalid).
 * - Saves run one at a time, in order: a slow response never overwrites a newer one, and `useApiMutation`'s
 *   in-flight guard never rejects an overlapping save.
 * - A pending save is flushed on unmount, so leaving the page within the debounce keeps the change.
 * - `error` keeps the server's message until the next change or successful save.
 */
export function useDebouncedSave<T>(
    save: (value: T) => Promise<unknown>,
    { initial, delay = AUTO_SAVE_DEBOUNCE_MS, dedupe = true }: Options<T> = {},
) {
    const [ status, setStatus ] = useState<SaveStatus>("idle");
    const [ saving, setSaving ] = useState(false);
    const [ error, setError ] = useState<string | null>(null);

    const saveRef = useRef(save);
    const pending = useRef<{ value: T } | null>(null);
    const committed = useRef<string | undefined>(dedupe && initial !== undefined ? keyOf(initial) : undefined);
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const statusTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const queue = useRef<Promise<void>>(Promise.resolve());
    const inFlight = useRef(0);
    const mounted = useRef(false);

    useEffect(() => { saveRef.current = save; });

    const run = useCallback(() => {
        clearTimeout(timer.current);
        const next = pending.current;
        if (!next) return;
        pending.current = null;
        const key = dedupe ? keyOf(next.value) : undefined;
        committed.current = key;
        inFlight.current += 1;
        if (mounted.current) setSaving(true);
        queue.current = queue.current.then(async () => {
            try {
                await saveRef.current(next.value);
                if (!mounted.current) return;
                setError(null);
                setStatus("saved");
            } catch (err) {
                // Let the same value be retried.
                if (key !== undefined && committed.current === key) committed.current = undefined;
                if (!mounted.current) return;
                setError(err instanceof Error ? err.message : ERR_SAVE);
                setStatus("error");
            } finally {
                inFlight.current -= 1;
                if (mounted.current) {
                    if (inFlight.current === 0) setSaving(false);
                    clearTimeout(statusTimer.current);
                    statusTimer.current = setTimeout(() => setStatus("idle"), SAVE_STATUS_CLEAR_MS);
                }
            }
        });
    }, [ dedupe ]);

    const cancel = useCallback(() => {
        clearTimeout(timer.current);
        pending.current = null;
    }, []);

    const schedule = useCallback((value: T) => {
        setError(null);
        if (dedupe && keyOf(value) === committed.current) {
            cancel();
            return;
        }
        pending.current = { value };
        clearTimeout(timer.current);
        timer.current = setTimeout(run, delay);
    }, [ cancel, dedupe, delay, run ]);

    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
            clearTimeout(statusTimer.current);
            run();
        };
    }, [ run ]);

    return { schedule, cancel, flush: run, status, saving, error };
}
