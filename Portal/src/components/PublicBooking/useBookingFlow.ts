import { useCallback, useEffect, useState } from "react";

export type BookingStep = "need" | "time" | "verify" | "details";

export interface FlowProgress {
    needDone: boolean;
    hasSlot: boolean;
    verified: boolean;
}

export function applicableSteps({ typeCount, locationCount, verified }: { typeCount: number; locationCount: number; verified: boolean }): BookingStep[] {
    return [
        ...(typeCount > 1 || locationCount > 1 ? [ "need" as const ] : []),
        "time",
        ...(verified ? [] : [ "verify" as const ]),
        "details",
    ];
}

/** Where a requested step really lands: history can ask for a step whose choices no longer exist. */
export function reachableStep(requested: BookingStep | null, steps: BookingStep[], { needDone, hasSlot, verified }: FlowProgress): BookingStep {
    const allowed = steps.filter((step) => {
        if (step === "need") return true;
        if (!needDone) return false;
        if (step === "time") return true;
        return hasSlot && (step === "verify" || verified);
    });
    const first = steps[ 0 ] as BookingStep;
    if (requested === null) return first;
    return allowed.includes(requested) ? requested : allowed.at(-1) ?? first;
}

/** A history entry for `step`. It drops any overlay name, which belongs only to the entry that opened it. */
function stepEntry(step: BookingStep | null) {
    const entry = { ...window.history.state };
    delete entry.bookingStep;
    delete entry.overlay;
    return step === null ? entry : { ...entry, bookingStep: step };
}

/** The booking step, kept in history so the back button walks the steps. Entries hold only the step's name. */
export function useBookingFlow(steps: BookingStep[], progress: FlowProgress) {
    const [ { requested, moved }, setNavigation ] = useState<{ requested: BookingStep | null; moved: boolean }>({ requested: null, moved: false });

    useEffect(() => {
        // A reload loses the choices, so whatever this entry asked for no longer applies.
        window.history.replaceState(stepEntry(null), "");

        const onPopState = () => {
            const next = (window.history.state?.bookingStep as BookingStep | undefined) ?? null;
            setNavigation((current) => ({ requested: next, moved: current.moved || next !== current.requested }));
        };
        window.addEventListener("popstate", onPopState);
        return () => window.removeEventListener("popstate", onPopState);
    }, []);

    const go = useCallback((next: BookingStep) => {
        window.history.pushState(stepEntry(next), "");
        setNavigation({ requested: next, moved: true });
    }, []);

    const back = useCallback(() => window.history.back(), []);

    const step = reachableStep(requested, steps, progress);
    // Where a request lands is final: left alone, it would come back to life as soon as a choice allowed it.
    if (requested !== null && requested !== step) setNavigation({ requested: step, moved });

    const index = steps.indexOf(step);
    return { step, index, total: steps.length, isFirst: index === 0, moved, go, back };
}
