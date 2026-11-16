import { describe, expect, it } from "vitest";
import { fmtMoney } from "@/src/utils/money";

describe("fmtMoney", () => {
    it("formats pesos with dot grouping and a plain space", () => {
        expect(fmtMoney(150000)).toBe("$ 150.000");
        expect(fmtMoney(1234567)).toBe("$ 1.234.567");
    });

    it("groups four-digit amounts too", () => {
        expect(fmtMoney(1500)).toBe("$ 1.500");
        expect(fmtMoney(0)).toBe("$ 0");
    });
});
