import { vi } from "vitest";

export function installScrollRestorationModel(initialY: number) {
    let y = initialY;
    const saved = new Map<string, number>();
    const entryKey = () => String(window.history.state?.overlay ?? "page");
    const visibleY = () => (document.body.style.position === "fixed" ? 0 : y);

    const scrollYDescriptor = Object.getOwnPropertyDescriptor(window, "scrollY");
    Object.defineProperty(window, "scrollY", { configurable: true, get: visibleY });
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(((_x: number, nextY: number) => {
        y = nextY;
    }) as typeof window.scrollTo);

    const originalPush = window.history.pushState.bind(window.history);
    const push = vi.spyOn(window.history, "pushState").mockImplementation((state, unused, url) => {
        saved.set(entryKey(), visibleY());
        originalPush(state, unused, url);
    });
    const onPopState = () => {
        const restored = saved.get(entryKey());
        if (restored !== undefined) y = document.body.style.position === "fixed" ? 0 : restored;
    };
    window.addEventListener("popstate", onPopState);

    return {
        get y() { return y; },
        restore() {
            window.removeEventListener("popstate", onPopState);
            push.mockRestore();
            scrollTo.mockRestore();
            if (scrollYDescriptor) Object.defineProperty(window, "scrollY", scrollYDescriptor);
            else delete (window as { scrollY?: number }).scrollY;
        },
    };
}
