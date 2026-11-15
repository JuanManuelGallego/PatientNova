import { useCallback, useEffect, useRef, useState } from "react";

export function useSavedFlash(ms = 3000) {
    const [ active, setActive ] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => () => {
        if (timer.current) clearTimeout(timer.current);
    }, []);

    const flash = useCallback(() => {
        if (timer.current) clearTimeout(timer.current);
        setActive(true);
        timer.current = setTimeout(() => setActive(false), ms);
    }, [ ms ]);

    return { active, flash };
}
