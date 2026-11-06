import { useCallback, useEffect, useState } from "react";

/**
 * Open state for a sheet that the browser's back button closes. Each opening adds a history entry, which
 * holds only the overlay's name.
 */
export function useHistoryOverlay(name: string) {
    const [ open, setOpen ] = useState(false);

    useEffect(() => {
        const onPopState = () => setOpen(window.history.state?.overlay === name);
        window.addEventListener("popstate", onPopState);
        return () => window.removeEventListener("popstate", onPopState);
    }, [ name ]);

    const show = useCallback(() => {
        window.history.pushState({ ...window.history.state, overlay: name }, "");
        setOpen(true);
    }, [ name ]);

    const hide = useCallback(() => window.history.back(), []);

    return { open, show, hide };
}
