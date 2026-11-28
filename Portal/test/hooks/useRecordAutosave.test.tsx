import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRecordAutosave } from "@/src/hooks/useRecordAutosave";
import { ApiClientError } from "@/src/api/base/apiClients";
import type { RecordPatch } from "@/src/types/MedicalRecord";

const DELAY = 100;
const TEMPLATE_MISMATCH = "Los datos de la historia clínica no coinciden con la plantilla";

async function advance(ms: number) {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const setup = (save: (id: string, patch: RecordPatch) => Promise<unknown>, onRejected = vi.fn()) =>
  renderHook(({ id }) => useRecordAutosave(id, { save, onRejected, delay: DELAY }), { initialProps: { id: "r1" as string | undefined } });

describe("useRecordAutosave", () => {
  it("sends only the changed keys, accumulated until the debounce elapses", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result } = setup(save);
    act(() => { result.current.change({ data: { a: "1" } }); result.current.change({ data: { b: "2" } }); });
    await advance(DELAY);
    expect(save).toHaveBeenCalledWith("r1", { data: { a: "1", b: "2" } });
    act(() => result.current.change({ name: "Ana" }));
    await advance(DELAY);
    expect(save).toHaveBeenLastCalledWith("r1", { name: "Ana" });
  });

  it("resends what a failed save carried with the next change", async () => {
    const save = vi.fn().mockRejectedValueOnce(new ApiClientError("sin conexión", 0)).mockResolvedValue(undefined);
    const { result } = setup(save);
    act(() => result.current.change({ data: { a: "1" } }));
    await advance(DELAY);
    act(() => result.current.change({ data: { b: "2" } }));
    await advance(DELAY);
    expect(save).toHaveBeenLastCalledWith("r1", { data: { a: "1", b: "2" } });
  });

  it("never resends a change the server refused, and reports it", async () => {
    const onRejected = vi.fn();
    const save = vi.fn().mockRejectedValueOnce(new ApiClientError("plantilla", 400, TEMPLATE_MISMATCH)).mockResolvedValue(undefined);
    const { result } = setup(save, onRejected);
    act(() => result.current.change({ data: { viejo: "x" } }));
    await advance(DELAY);
    expect(onRejected).toHaveBeenCalledTimes(1);
    act(() => result.current.change({ name: "Ana" }));
    await advance(DELAY);
    expect(save).toHaveBeenLastCalledWith("r1", { name: "Ana" });
  });

  it("keeps any other refused change for the next save, without reloading", async () => {
    const onRejected = vi.fn();
    const save = vi.fn().mockRejectedValueOnce(new ApiClientError("datos", 400, "Validation failed")).mockResolvedValue(undefined);
    const { result } = setup(save, onRejected);
    act(() => result.current.change({ familyMembers: [] }));
    await advance(DELAY);
    act(() => result.current.change({ name: "Ana" }));
    await advance(DELAY);
    expect(onRejected).not.toHaveBeenCalled();
    expect(save).toHaveBeenLastCalledWith("r1", { familyMembers: [], name: "Ana" });
  });

  it("starts empty for another record", async () => {
    const save = vi.fn().mockRejectedValueOnce(new ApiClientError("sin conexión", 0)).mockResolvedValue(undefined);
    const { result, rerender } = setup(save);
    act(() => result.current.change({ data: { a: "1" } }));
    await advance(DELAY);
    rerender({ id: "r2" });
    act(() => { result.current.reset("r2"); result.current.change({ data: { b: "2" } }); });
    await advance(DELAY);
    expect(save).toHaveBeenLastCalledWith("r2", { data: { b: "2" } });
  });
});
