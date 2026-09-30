import { computeHourRange, toUtcRangeFromLocalDay } from "@/src/components/Calendar/constants";
import { BlockedTime } from "@/src/types/BlockedTime";
import { describe, expect, it } from "vitest";

describe("computeHourRange", () => {
  it("includes blocked times outside the default hours", () => {
    const blockedTime = {
      startTimeUtc: new Date(2026, 8, 30, 4).toISOString(),
      endTimeUtc: new Date(2026, 8, 30, 5).toISOString(),
    } as BlockedTime;

    expect(computeHourRange([], [blockedTime]).firstHour).toBe(3);
  });
});

describe("toUtcRangeFromLocalDay", () => {
  it("converts a user's local day using daylight-saving time", () => {
    expect(toUtcRangeFromLocalDay("2026-07-01", "America/New_York")).toEqual({
      dateFrom: "2026-07-01T04:00:00.000Z",
      dateTo: "2026-07-02T03:59:59.999Z",
    });
  });
});
