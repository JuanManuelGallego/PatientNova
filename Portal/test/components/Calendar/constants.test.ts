import { describe, expect, it } from "vitest";
import { computeHourRange } from "@/src/components/Calendar/constants";
import { BlockedTime } from "@/src/types/BlockedTime";

describe("computeHourRange", () => {
  it("includes blocked times outside the default hours", () => {
    const blockedTime = {
      startTimeUtc: new Date(2026, 8, 30, 4).toISOString(),
      endTimeUtc: new Date(2026, 8, 30, 5).toISOString(),
    } as BlockedTime;

    expect(computeHourRange([], [blockedTime]).firstHour).toBe(3);
  });
});
