import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PendingRequestsProvider } from "@/src/providers/PendingRequestsContext";

const refetch = vi.fn().mockResolvedValue(undefined);
let user: { role: string } | null;

vi.mock("@/src/api/booking-requests/useFetchPendingRequestsCount", () => ({
  useFetchPendingRequestsCount: () => ({ pending: 0, refetch }),
}));
vi.mock("@/src/providers/AuthContext", () => ({ useAuthContext: () => ({ user }) }));

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => {
  vi.useFakeTimers();
  refetch.mockClear();
  user = { role: "ADMIN" };
});
afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(document, "visibilityState");
});

describe("PendingRequestsProvider foreground refresh", () => {
  it("refetches when the document becomes visible", () => {
    render(<PendingRequestsProvider><p>x</p></PendingRequestsProvider>);
    setVisibility("visible");
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("does not refetch when the document becomes hidden", () => {
    render(<PendingRequestsProvider><p>x</p></PendingRequestsProvider>);
    setVisibility("hidden");
    expect(refetch).not.toHaveBeenCalled();
  });

  it("does not listen when the inbox is disabled", () => {
    user = { role: "VIEWER" };
    render(<PendingRequestsProvider><p>x</p></PendingRequestsProvider>);
    setVisibility("visible");
    expect(refetch).not.toHaveBeenCalled();
  });

  it("skips hidden-tab polling and resumes when the tab becomes visible", () => {
    setVisibility("visible");
    const { unmount } = render(<PendingRequestsProvider><p>x</p></PendingRequestsProvider>);
    act(() => { vi.advanceTimersByTime(2 * 60_000); });
    expect(refetch).toHaveBeenCalledTimes(1);

    setVisibility("hidden");
    act(() => { vi.advanceTimersByTime(6 * 60_000); });
    expect(refetch).toHaveBeenCalledTimes(1);

    setVisibility("visible");
    expect(refetch).toHaveBeenCalledTimes(2);
    act(() => { vi.advanceTimersByTime(2 * 60_000); });
    expect(refetch).toHaveBeenCalledTimes(3);

    unmount();
    act(() => { vi.advanceTimersByTime(2 * 60_000); });
    setVisibility("visible");
    expect(refetch).toHaveBeenCalledTimes(3);
  });
});
