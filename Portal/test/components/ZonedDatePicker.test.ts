import { afterEach, beforeEach, describe, expect, it } from "vitest";
import dayjs from "dayjs";
import { fromPickerValue, nowInZone, toPickerValue } from "@/src/components/ZonedDatePicker";

// The device is in New York, the provider in Bogotá. 2026-03-08 02:30 does not exist in New York
// (spring-forward), but it is an ordinary time in Bogotá and must be saved as 07:30Z.
describe("ZonedDatePicker values", () => {
    const originalTz = process.env.TZ;
    beforeEach(() => { process.env.TZ = "America/New_York"; });
    afterEach(() => { process.env.TZ = originalTz; });

    it("a browser-local dayjs would shift the gap time (the bug this avoids)", () => {
        expect(dayjs("2026-03-08T02:30:00").format("HH:mm")).toBe("03:30");
    });

    it("keeps a wall time in the device's DST gap through picker edits", () => {
        const picked = nowInZone("America/Bogota").year(2026).month(2).date(8).hour(2).minute(30).second(0);
        expect(picked.format("YYYY-MM-DD HH:mm")).toBe("2026-03-08 02:30");
        expect(fromPickerValue(picked, "America/Bogota")).toBe("2026-03-08T07:30:00.000Z");
    });

    it("round-trips stored instants as the provider's wall clock", () => {
        const value = toPickerValue("2026-03-08T07:30:00.000Z", "America/Bogota");
        expect(value.format("YYYY-MM-DD HH:mm")).toBe("2026-03-08 02:30");
        expect(fromPickerValue(value, "America/Bogota")).toBe("2026-03-08T07:30:00.000Z");
    });
});
