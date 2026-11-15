import { useEffect, useRef } from "react";

export function useScrollToHashWhenReady(ready: boolean) {
    const done = useRef(false);
    useEffect(() => {
        if (!ready || done.current) return;
        done.current = true;
        const id = decodeURIComponent(window.location.hash.slice(1));
        if (id) document.getElementById(id)?.scrollIntoView({ block: "start" });
    }, [ ready ]);
}
