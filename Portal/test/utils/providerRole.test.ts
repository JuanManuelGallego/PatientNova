import { describe, expect, it } from "vitest";
import { providerRole } from "@/src/utils/providerRole";

describe("providerRole", () => {
    it("joins a title and a different specialty", () => {
        expect(providerRole("Psicóloga", "Psicología clínica")).toBe("Psicóloga · Psicología clínica");
    });
    it("shows once a specialty that repeats the title", () => {
        expect(providerRole("Psicóloga clínica", "Psicología clínica y sistémica")).toBe("Psicología clínica y sistémica");
        expect(providerRole("Psicología clínica", "Psicología clínica")).toBe("Psicología clínica");
    });
    it("handles either part missing", () => {
        expect(providerRole(null, "Terapia")).toBe("Terapia");
        expect(providerRole("Médica", undefined)).toBe("Médica");
        expect(providerRole(null, null)).toBe("");
    });
});
