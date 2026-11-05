import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AUTO_SAVE_DEBOUNCE_MS, useDebouncedSave } from "@/src/hooks/useDebouncedSave";

async function advance(ms: number) {
    await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useDebouncedSave", () => {
    it("saves only the last value once the debounce elapses", async () => {
        const save = vi.fn().mockResolvedValue(undefined);
        const { result } = renderHook(() => useDebouncedSave<number>(save));
        act(() => { result.current.schedule(1); result.current.schedule(2); });
        await advance(AUTO_SAVE_DEBOUNCE_MS - 1);
        expect(save).not.toHaveBeenCalled();
        await advance(1);
        expect(save).toHaveBeenCalledTimes(1);
        expect(save).toHaveBeenCalledWith(2);
        expect(result.current.status).toBe("saved");
    });

    it("skips a value equal to the initial or last-sent one", async () => {
        const save = vi.fn().mockResolvedValue(undefined);
        const { result } = renderHook(() => useDebouncedSave<{ a: number }>(save, { initial: { a: 1 } }));
        act(() => { result.current.schedule({ a: 2 }); result.current.schedule({ a: 1 }); });
        await advance(AUTO_SAVE_DEBOUNCE_MS);
        expect(save).not.toHaveBeenCalled();
        act(() => result.current.schedule({ a: 2 }));
        await advance(AUTO_SAVE_DEBOUNCE_MS);
        act(() => result.current.schedule({ a: 2 }));
        await advance(AUTO_SAVE_DEBOUNCE_MS);
        expect(save).toHaveBeenCalledTimes(1);
    });

    it("saves repeated values when dedupe is off, honouring a custom delay", async () => {
        const save = vi.fn().mockResolvedValue(undefined);
        const { result } = renderHook(() => useDebouncedSave<number>(save, { initial: 1, delay: 1500, dedupe: false }));
        act(() => result.current.schedule(1));
        await advance(AUTO_SAVE_DEBOUNCE_MS);
        expect(save).not.toHaveBeenCalled();
        await advance(500);
        act(() => result.current.schedule(1));
        await advance(1500);
        expect(save).toHaveBeenCalledTimes(2);
    });

    it("runs saves one at a time, in order", async () => {
        const order: string[] = [];
        let releaseFirst!: () => void;
        const save = vi.fn((v: string) => {
            order.push(`start ${v}`);
            return v === "a"
                ? new Promise<void>((r) => { releaseFirst = () => { order.push("end a"); r(); }; })
                : Promise.resolve().then(() => { order.push(`end ${v}`); });
        });
        const { result } = renderHook(() => useDebouncedSave<string>(save));
        act(() => result.current.schedule("a"));
        await advance(AUTO_SAVE_DEBOUNCE_MS);
        expect(result.current.saving).toBe(true);
        act(() => result.current.schedule("b"));
        await advance(AUTO_SAVE_DEBOUNCE_MS);
        expect(order).toEqual([ "start a" ]);
        await act(async () => releaseFirst());
        await advance(0);
        expect(order).toEqual([ "start a", "end a", "start b", "end b" ]);
        expect(result.current.saving).toBe(false);
    });

    it("keeps the error message and lets the same value be retried", async () => {
        const save = vi.fn().mockRejectedValueOnce(new Error("Ese enlace ya está en uso.")).mockResolvedValue(undefined);
        const { result } = renderHook(() => useDebouncedSave<number>(save));
        act(() => result.current.schedule(5));
        await advance(AUTO_SAVE_DEBOUNCE_MS);
        expect(result.current.status).toBe("error");
        expect(result.current.error).toBe("Ese enlace ya está en uso.");
        act(() => result.current.schedule(5));
        expect(result.current.error).toBeNull();
        await advance(AUTO_SAVE_DEBOUNCE_MS);
        expect(save).toHaveBeenCalledTimes(2);
        expect(result.current.status).toBe("saved");
    });

    it("drops a cancelled save", async () => {
        const save = vi.fn().mockResolvedValue(undefined);
        const { result } = renderHook(() => useDebouncedSave<number>(save));
        act(() => { result.current.schedule(1); result.current.cancel(); });
        await advance(AUTO_SAVE_DEBOUNCE_MS);
        expect(save).not.toHaveBeenCalled();
    });

    it("flushes a pending save on unmount", async () => {
        const save = vi.fn().mockResolvedValue(undefined);
        const { result, unmount } = renderHook(() => useDebouncedSave<number>(save));
        act(() => result.current.schedule(7));
        unmount();
        await advance(0);
        expect(save).toHaveBeenCalledWith(7);
    });

    it("returns the status to idle after a while", async () => {
        const save = vi.fn().mockResolvedValue(undefined);
        const { result } = renderHook(() => useDebouncedSave<number>(save));
        act(() => result.current.schedule(1));
        await advance(AUTO_SAVE_DEBOUNCE_MS);
        expect(result.current.status).toBe("saved");
        await advance(3000);
        expect(result.current.status).toBe("idle");
    });
});
