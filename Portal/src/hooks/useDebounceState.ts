import { useState, useEffect } from "react";

export function useDebounceState<T>(value: T, delay: number) {
    const [ debounced, setDebounced ] = useState(value);

    useEffect(() => {
        const timeout = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(timeout);
    }, [ value, delay ]);

    return debounced;
}