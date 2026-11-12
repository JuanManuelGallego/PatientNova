import { describe, expect, it } from "vitest";
import { applicableSteps, reachableStep, type BookingStep } from "@/src/components/PublicBooking/useBookingFlow";

const ALL: BookingStep[] = [ "need", "time", "details" ];

describe("applicableSteps", () => {
    it("has no verification step: steps are need, time and details", () => {
        expect(applicableSteps({ typeCount: 2, locationCount: 1 })).toEqual([ "need", "time", "details" ]);
        expect(applicableSteps({ typeCount: 2, locationCount: 1 })).not.toContain("verify");
    });

    it("skips Tu cita with one type and one place", () => {
        expect(applicableSteps({ typeCount: 1, locationCount: 1 })).toEqual([ "time", "details" ]);
    });

    it("keeps Tu cita when either choice is real", () => {
        expect(applicableSteps({ typeCount: 2, locationCount: 1 })).toEqual(ALL);
        expect(applicableSteps({ typeCount: 1, locationCount: 2 })).toEqual(ALL);
    });
});

describe("reachableStep", () => {
    it("starts at the first step", () => {
        expect(reachableStep(null, ALL, { needDone: false, hasSlot: false })).toBe("need");
    });

    it("never lands past what the choices allow", () => {
        expect(reachableStep("details", ALL, { needDone: true, hasSlot: false })).toBe("time");
        expect(reachableStep("time", ALL, { needDone: false, hasSlot: false })).toBe("need");
        expect(reachableStep("details", ALL, { needDone: true, hasSlot: true })).toBe("details");
    });

    it("sends a stale verification entry to Tus datos", () => {
        expect(reachableStep("verify" as BookingStep, [ "time", "details" ], { needDone: true, hasSlot: true })).toBe("details");
    });

    it("honors a step the choices allow", () => {
        expect(reachableStep("time", ALL, { needDone: true, hasSlot: true })).toBe("time");
    });
});
