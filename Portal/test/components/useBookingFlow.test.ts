import { describe, expect, it } from "vitest";
import { applicableSteps, reachableStep, type BookingStep } from "@/src/components/PublicBooking/useBookingFlow";

const ALL: BookingStep[] = [ "need", "time", "verify", "details" ];

describe("applicableSteps", () => {
    it("skips Tu cita with one type and one place, and verification with a session", () => {
        expect(applicableSteps({ typeCount: 1, locationCount: 1, verified: true })).toEqual([ "time", "details" ]);
    });

    it("keeps Tu cita when either choice is real", () => {
        expect(applicableSteps({ typeCount: 2, locationCount: 1, verified: false })).toEqual(ALL);
        expect(applicableSteps({ typeCount: 1, locationCount: 2, verified: false })).toEqual(ALL);
    });
});

describe("reachableStep", () => {
    it("starts at the first step", () => {
        expect(reachableStep(null, ALL, { needDone: false, hasSlot: false, verified: false })).toBe("need");
    });

    it("never lands past what the choices allow", () => {
        expect(reachableStep("details", ALL, { needDone: true, hasSlot: false, verified: false })).toBe("time");
        expect(reachableStep("time", ALL, { needDone: false, hasSlot: false, verified: false })).toBe("need");
        expect(reachableStep("details", ALL, { needDone: true, hasSlot: true, verified: false })).toBe("verify");
    });

    it("sends a removed verification step to Tus datos", () => {
        expect(reachableStep("verify", [ "time", "details" ], { needDone: true, hasSlot: true, verified: true })).toBe("details");
    });

    it("honors a step the choices allow", () => {
        expect(reachableStep("time", ALL, { needDone: true, hasSlot: true, verified: true })).toBe("time");
    });
});
