import "@testing-library/jest-dom/vitest";

// jsdom has no matchMedia. No query matches, so tests render the phone layout unless they stub a wider one.
if (typeof window !== "undefined") {
    Object.defineProperty(window, "matchMedia", {
        writable: true,
        configurable: true,
        value: (query: string) => ({
            matches: false,
            media: query,
            addEventListener: () => undefined,
            removeEventListener: () => undefined,
        }),
    });
}
