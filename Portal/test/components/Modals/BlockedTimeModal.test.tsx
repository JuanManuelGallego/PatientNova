import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BlockedTimeModal } from "@/src/components/Modals/BlockedTimeModal";
import { renderWithTrap, useTouchEnv } from "../Pickers/touchEnv";

vi.mock("@/src/providers/ThemeContext", () => ({ useTheme: () => ({ isDark: false }) }));
vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });

const createBlockedTime = vi.fn(async () => ({}));
const updateBlockedTime = vi.fn(async () => ({}));
vi.mock("@/src/api/blocked-time/useCreateBlockedTime", () => ({ useCreateBlockedTime: () => ({ createBlockedTime }) }));
vi.mock("@/src/api/blocked-time/useUpdateBlockedTime", () => ({ useUpdateBlockedTime: () => ({ updateBlockedTime }) }));
vi.mock("@/src/api/blocked-time/useDeleteBlockedTime", () => ({ useDeleteBlockedTime: () => ({ deleteBlockedTime: vi.fn() }) }));

const value = (testId: string) => (screen.getByTestId(testId) as HTMLInputElement).value;

describe("BlockedTimeModal", () => {
    useTouchEnv({ now: "2026-03-02T03:40:00Z", providerZone: "America/Bogota", deviceZone: "Europe/Madrid", coarse: false });

    it("offers one hour on one day by default, ending by 23:55", () => {
        renderWithTrap(<BlockedTimeModal prefillDate="2026-03-05" onClose={() => {}} onSaved={() => {}} />);
        expect([ value("blocked-time-date"), value("blocked-time-start"), value("blocked-time-end") ]).toEqual([ "05/03/2026", "09:00", "10:00" ]);
    });

    it("stops a late default block at 23:55 instead of tomorrow", () => {
        renderWithTrap(<BlockedTimeModal onClose={() => {}} onSaved={() => {}} />);
        expect([ value("blocked-time-date"), value("blocked-time-start"), value("blocked-time-end") ]).toEqual([ "01/03/2026", "23:00", "23:55" ]);
    });

    it("saves the range from the three boxes", async () => {
        renderWithTrap(<BlockedTimeModal prefillDate="2026-03-05" onClose={() => {}} onSaved={() => {}} />);
        fireEvent.change(screen.getByTestId("blocked-time-end"), { target: { value: "11:30" } });
        fireEvent.blur(screen.getByTestId("blocked-time-end"));
        fireEvent.click(screen.getByTestId("blocked-time-modal-submit-button"));
        await waitFor(() => expect(createBlockedTime).toHaveBeenCalledWith({
            description: null, startTimeUtc: "2026-03-05T14:00:00.000Z", endTimeUtc: "2026-03-05T16:30:00.000Z",
        }));
    });

    it("shows a block saved across days as text and saves only its description", async () => {
        const blockedTime = {
            id: "bt-1", description: "Vacaciones", createdAt: "", updatedAt: "",
            startTimeUtc: "2026-03-09T14:00:00.000Z", endTimeUtc: "2026-03-13T23:00:00.000Z",
        };
        renderWithTrap(<BlockedTimeModal blockedTime={blockedTime} onClose={() => {}} onSaved={() => {}} />);
        expect(screen.getByTestId("blocked-time-spans-days")).toHaveTextContent("Este bloqueo dura más de un día");
        expect(screen.queryByTestId("blocked-time-start")).toBeNull();
        fireEvent.change(screen.getByTestId("blocked-time-description-input"), { target: { value: "Viaje" } });
        fireEvent.click(screen.getByTestId("blocked-time-modal-submit-button"));
        await waitFor(() => expect(updateBlockedTime).toHaveBeenCalledWith("bt-1", { description: "Viaje" }));
    });
});
