import { describe, expect, it } from "vitest";
import { SettingsTab, settingsTabHref } from "@/src/config/settingsTabs";

describe("settingsTabHref", () => {
    it("links a tab by its label, encoded the way the page reads it", () => {
        expect(settingsTabHref(SettingsTab.AppointmentTypes)).toBe("/settings?tab=Tipos+de+Cita");
        expect(settingsTabHref(SettingsTab.OnlineBooking)).toBe("/settings?tab=Reserva+en+l%C3%ADnea");
    });
});
