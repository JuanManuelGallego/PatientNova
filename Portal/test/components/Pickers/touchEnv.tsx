import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, vi } from "vitest";
import { FocusTrapProvider } from "@/src/hooks/useFocusTrap";
import { setDisplayTimezone } from "@/src/utils/TimeUtils";

/** Stubs `matchMedia` so only `(pointer: coarse)` matches (touch) or nothing does (mouse). */
export function setPointer(coarse: boolean) {
    window.matchMedia = ((query: string) => ({
        matches: coarse && query === "(pointer: coarse)",
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
        onchange: null,
    })) as unknown as typeof window.matchMedia;
}

/**
 * A device in New York with the provider in `providerZone`, the clock fixed at `now`, and a touch screen.
 * Only `Date` is faked, so React's timers keep running.
 */
export function useTouchEnv({ now, providerZone, deviceZone = "America/New_York" }: {
    now: string;
    providerZone: string;
    deviceZone?: string;
}) {
    const originalMatchMedia = window.matchMedia;
    const originalTz = process.env.TZ;
    beforeEach(() => {
        process.env.TZ = deviceZone;
        vi.useFakeTimers({ toFake: [ "Date" ] });
        vi.setSystemTime(new Date(now));
        setDisplayTimezone(providerZone);
        setPointer(true);
        vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    });
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        setDisplayTimezone(undefined);
        window.matchMedia = originalMatchMedia;
        if (originalTz === undefined) delete process.env.TZ;
        else process.env.TZ = originalTz;
    });
}

function Providers({ children }: { children: ReactNode }) {
    return <FocusTrapProvider dismissOnBack>{children}</FocusTrapProvider>;
}

export function renderWithTrap(ui: ReactElement, options?: RenderOptions) {
    return render(ui, { wrapper: Providers, ...options });
}
